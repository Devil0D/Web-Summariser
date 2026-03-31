"""
PDF Handler Module
==================
Handles PDF text extraction with robust error handling.
Used for preprocessing PDFs before sending to summarization models.
"""

import io
import logging
from typing import Tuple
from fastapi import HTTPException

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

logger = logging.getLogger(__name__)


def extract_pdf_text(pdf_data: bytes, use_pdfplumber: bool = False) -> Tuple[str, dict]:
    """
    Extract text from PDF bytes.
    
    Args:
        pdf_data: Raw PDF file bytes
        use_pdfplumber: If True, use pdfplumber; otherwise use pypdf
        
    Returns:
        Tuple of (extracted_text, metadata)
        metadata contains: {'pages': int, 'method': str, 'has_text': bool}
        
    Raises:
        HTTPException: If PDF cannot be processed
    """
    if not pdf_data or len(pdf_data) == 0:
        raise HTTPException(400, "PDF file is empty")
    
    metadata = {
        "pages": 0,
        "method": "unknown",
        "has_text": False,
        "extraction_quality": "unknown"
    }
    
    # Try pdfplumber first if requested (generally better quality)
    if use_pdfplumber and pdfplumber:
        try:
            with pdfplumber.open(io.BytesIO(pdf_data)) as pdf:
                pages_text = []
                metadata["pages"] = len(pdf.pages)
                
                for page_num, page in enumerate(pdf.pages, 1):
                    try:
                        text = page.extract_text()
                        if text and text.strip():
                            pages_text.append(text)
                    except Exception as e:
                        logger.warning(f"Failed to extract text from page {page_num}: {e}")
                        continue
                
                extracted = "\n".join(pages_text)
                if extracted.strip():
                    metadata["extraction_quality"] = "good"
                    metadata["has_text"] = True
                    metadata["method"] = "pdfplumber"
                    return extracted, metadata
                else:
                    logger.info("pdfplumber: No text extracted, trying pypdf fallback...")
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}, trying pypdf...")
    
    # Fallback to pypdf
    if pypdf:
        try:
            reader = pypdf.PdfReader(io.BytesIO(pdf_data))
            pages_text = []
            metadata["pages"] = len(reader.pages)
            
            for page_num, page in enumerate(reader.pages, 1):
                try:
                    text = page.extract_text()
                    if text and text.strip():
                        pages_text.append(text)
                except Exception as e:
                    logger.warning(f"Failed to extract text from page {page_num} via pypdf: {e}")
                    continue
            
            extracted = "\n".join(pages_text)
            if extracted.strip():
                metadata["extraction_quality"] = "good"
                metadata["has_text"] = True
                metadata["method"] = "pypdf"
                return extracted, metadata
        except Exception as e:
            logger.error(f"pypdf extraction failed: {e}")
            raise HTTPException(500, f"Failed to read PDF: {e}")
    
    # Both methods failed or neither is available
    if not pypdf and not pdfplumber:
        raise HTTPException(
            500,
            "PDF processing libraries not available. Install 'pypdf' or 'pdfplumber'."
        )
    
    raise HTTPException(
        400,
        "PDF appears to be image-only or corrupted — no extractable text found. "
        "Consider using OCR or ensure the PDF contains selectable text."
    )


def clean_extracted_text(text: str, max_chars: int = 50000) -> str:
    """
    Clean and normalize extracted PDF text.
    
    Args:
        text: Raw extracted text
        max_chars: Maximum characters to keep
        
    Returns:
        Cleaned text
    """
    import re
    
    # Remove excessive whitespace
    cleaned = re.sub(r"\n\s*\n", "\n\n", text)  # normalize double newlines
    cleaned = re.sub(r"[ \t]+", " ", cleaned)   # normalize spaces/tabs
    cleaned = cleaned.strip()
    
    # Truncate if needed
    if len(cleaned) > max_chars:
        logger.warning(f"Extracted text truncated from {len(cleaned)} to {max_chars} chars")
        cleaned = cleaned[:max_chars]
    
    return cleaned


def get_pdf_metadata(pdf_data: bytes) -> dict:
    """
    Extract metadata from PDF (page count, creation date, etc).
    
    Args:
        pdf_data: Raw PDF file bytes
        
    Returns:
        Dictionary with PDF metadata
    """
    try:
        if pypdf:
            reader = pypdf.PdfReader(io.BytesIO(pdf_data))
            metadata = reader.metadata or {}
            return {
                "pages": len(reader.pages),
                "title": metadata.get("/Title", "Unknown"),
                "author": metadata.get("/Author", "Unknown"),
                "created": metadata.get("/CreationDate", "Unknown"),
            }
    except Exception as e:
        logger.warning(f"Could not extract PDF metadata: {e}")
    
    return {"pages": 0, "title": "Unknown", "author": "Unknown", "created": "Unknown"}
