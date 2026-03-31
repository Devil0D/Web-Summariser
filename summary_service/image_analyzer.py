"""
Image Analyzer Module
=====================
Lightweight image analysis and summarization.
Extracts content from images and generates short summaries.
"""

import io
import logging
from typing import Tuple, Optional
from fastapi import HTTPException

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    from transformers import pipeline
except ImportError:
    pipeline = None

logger = logging.getLogger(__name__)

# Lightweight models for image analysis
# These are small enough to run on CPU while still being useful
MODELS = {
    "image_to_text": "Salesforce/blip-image-captioning-base",  # ~355MB, balanced size/quality
    "image_classification": "google/vit-base-patch16-224",     # ~346MB for classification
}

# Cache for loaded models (avoid reloading)
_model_cache = {}


def _get_model(task: str, model_name: str = None):
    """Load and cache a model."""
    if not pipeline:
        raise HTTPException(500, "transformers library not available")
    
    cache_key = f"{task}_{model_name or 'default'}"
    
    if cache_key not in _model_cache:
        try:
            logger.info(f"Loading model for task '{task}'...")
            model = pipeline(task, model=model_name, device=-1)  # -1 = CPU
            _model_cache[cache_key] = model
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise HTTPException(500, f"Could not load image analysis model: {e}")
    
    return _model_cache[cache_key]


def load_image(image_data: bytes) -> Optional[Image.Image]:
    """
    Load and validate image from bytes.
    
    Args:
        image_data: Raw image file bytes
        
    Returns:
        PIL Image object or None
        
    Raises:
        HTTPException: If image is invalid
    """
    if not Image:
        raise HTTPException(500, "PIL (Pillow) not available")
    
    if not image_data or len(image_data) == 0:
        raise HTTPException(400, "Image file is empty")
    
    try:
        img = Image.open(io.BytesIO(image_data))
        # Validate that it's an image
        img.load()  # Force load to check validity
        
        # Check minimum size (avoid thumbnails)
        if img.size[0] < 100 or img.size[1] < 100:
            logger.warning(f"Image is very small: {img.size}")
        
        return img
    except Exception as e:
        raise HTTPException(400, f"Invalid image file: {e}")


def analyze_image_content(image_data: bytes) -> Tuple[str, dict]:
    """
    Analyze image content and generate description.
    
    Args:
        image_data: Raw image file bytes
        
    Returns:
        Tuple of (description, metadata)
        metadata contains: {'model': str, 'size': tuple, 'format': str, 'analysis_type': str}
    """
    img = load_image(image_data)
    
    metadata = {
        "size": img.size,
        "format": img.format or "Unknown",
        "mode": img.mode,
        "analysis_type": "image_to_text",
        "model": "blip-image-captioning"
    }
    
    try:
        # Load image-to-text model
        model = _get_model("image-to-text", MODELS["image_to_text"])
        
        # Generate caption/description
        result = model(img)
        description = result[0]["generated_text"] if result else "No description generated"
        
        logger.info(f"Generated description: {description[:50]}...")
        return description, metadata
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image analysis failed: {e}")
        raise HTTPException(500, f"Failed to analyze image: {e}")


def generate_image_summary(image_data: bytes) -> dict:
    """
    Analyze image and generate a structured summary.
    
    Args:
        image_data: Raw image file bytes
        
    Returns:
        Dictionary with:
        - 'short_summary': One-line description
        - 'detailed_analysis': Full description
        - 'image_info': Image metadata
        - 'confidence': Optional confidence score
    """
    description, metadata = analyze_image_content(image_data)
    
    # Format as bullet points for consistency with text summaries
    lines = [
        "Image Analysis Summary:",
        "",
        "Content Description:",
        description,
        ""
    ]
    
    if metadata["size"]:
        lines.append(f"Image Details: {metadata['size'][0]}x{metadata['size'][1]}px, {metadata['format']}")
    
    summary = "\n".join(lines).strip()
    
    return {
        "short_summary": description,
        "detailed_analysis": summary,
        "image_info": metadata,
    }


def extract_image_text(image_data: bytes) -> dict:
    """
    Extract any visible text from image using OCR-like approach.
    Uses image-to-text model to describe text content found in the image.
    
    Args:
        image_data: Raw image file bytes
        
    Returns:
        Dictionary with extracted information
    """
    # Currently uses the image-to-text model which describes the image
    # For true OCR, would need pytesseract + Tesseract system package
    description, metadata = analyze_image_content(image_data)
    
    return {
        "type": "image_description",
        "content": description,
        "method": "vision_model",
        "metadata": metadata,
        "note": "For precise OCR text extraction, install pytesseract and Tesseract-OCR"
    }


def validate_image_file(filename: str, content_type: str = "") -> bool:
    """
    Validate if file is a supported image format.
    
    Args:
        filename: Original filename
        content_type: MIME type
        
    Returns:
        True if supported, False otherwise
    """
    supported_formats = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}
    supported_mimes = {
        "image/jpeg", "image/png", "image/gif", "image/bmp", 
        "image/webp", "image/x-windows-bmp"
    }
    
    ext = f".{filename.split('.')[-1].lower()}" if "." in filename else ""
    mime = content_type.lower()
    
    return ext in supported_formats or any(m in mime for m in supported_mimes)
