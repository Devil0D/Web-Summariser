"""
Websears Summary Service — FastAPI Edition (v3.0)
Modular, optimized, with robust OCR, chunked summarization, and intelligent routing.

Run: uvicorn main:app --reload --port 5001
"""

from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import warnings
import io
import os
import shutil

# Core summarization models
from bart import bart_summary
from T5 import t5_summary
from extractive_summary import extractive_summary

# File extraction modules
import pypdf
try:
    from docx import Document
except ImportError:
    Document = None
    
try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None
    Image = None

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _configure_tesseract() -> bool:
    """Resolve and configure Tesseract executable path for pytesseract."""
    if pytesseract is None:
        return False

    candidates = []

    env_cmd = os.getenv("TESSERACT_CMD")
    if env_cmd:
        candidates.append(env_cmd)

    system_cmd = shutil.which("tesseract")
    if system_cmd:
        candidates.append(system_cmd)

    candidates.extend([
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ])

    for candidate in candidates:
        if not candidate:
            continue
        if os.path.exists(candidate) or shutil.which(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            logger.info(f"Tesseract configured: {candidate}")
            return True

    logger.warning("Tesseract executable not found. Set TESSERACT_CMD or install Tesseract-OCR.")
    return False

app = FastAPI(
    title="Websears Summary Service v3",
    description="Optimized BART · T5 · LexRank summarisation with robust OCR and smart chunking",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
MAX_CHARS = 50_000
TIMEOUT_SECONDS = 60
TESSERACT_READY = _configure_tesseract()


# ── Helper Functions ──────────────────────────────────────────────────────────

def truncate_text(text: str) -> str:
    """Truncate text to MAX_CHARS limit."""
    if len(text) > MAX_CHARS:
        logger.warning(f"Input truncated from {len(text)} to {MAX_CHARS} chars")
        return text[:MAX_CHARS]
    return text


def _extract_text_from_pdf(data: bytes) -> str:
    """Extract text from PDF bytes."""
    try:
        pdf_reader = pypdf.PdfReader(io.BytesIO(data))
        text = " ".join(page.extract_text() or "" for page in pdf_reader.pages)
        return text.strip()
    except Exception as e:
        raise ValueError(f"PDF extraction failed: {e}")


def _extract_text_from_docx(data: bytes) -> str:
    """Extract text from DOCX bytes."""
    if Document is None:
        raise ValueError("DOCX support requires python-docx. Install with: pip install python-docx")
    try:
        doc = Document(io.BytesIO(data))
        text = " ".join(para.text for para in doc.paragraphs)
        return text.strip()
    except Exception as e:
        raise ValueError(f"DOCX extraction failed: {e}")


def _extract_text_from_image(data: bytes) -> str:
    """Extract text from image using OCR with preprocessing."""
    if pytesseract is None or Image is None:
        raise ValueError("OCR support requires pytesseract and Pillow. Install: pip install pytesseract pillow")
    if not TESSERACT_READY:
        raise ValueError(
            "Tesseract executable not found. Install Tesseract-OCR and set TESSERACT_CMD, "
            "or add tesseract.exe to PATH."
        )
    
    try:
        from PIL import ImageEnhance, ImageFilter
        
        image = Image.open(io.BytesIO(data))
        
        # Convert to grayscale for better OCR
        if image.mode != 'L':
            image = image.convert('L')
        
        # Preprocessing pipeline for better OCR
        # 1. Reduce noise with median filter
        image = image.filter(ImageFilter.MedianFilter(size=3))
        
        # 2. Increase contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)
        
        # 3. Increase brightness slightly
        enhancer = ImageEnhance.Brightness(image)
        image = enhancer.enhance(1.1)
        
        # Extract text
        text = pytesseract.image_to_string(image).strip()
        
        # Retry with sharpening if first attempt yielded nothing
        if not text or len(text) < 5:
            sharpen_filter = ImageFilter.SHARPEN
            image_sharp = Image.open(io.BytesIO(data)).convert('L')
            image_sharp = image_sharp.filter(sharpen_filter)
            text = pytesseract.image_to_string(image_sharp).strip()
        
        if not text:
            return "[No readable text detected. Image may be too low quality or contain no text.]"
        
        return text
        
    except Exception as e:
        if "tesseract" in str(e).lower() and "not" in str(e).lower() and "found" in str(e).lower():
            raise ValueError(
                "Tesseract executable not found. Install Tesseract-OCR and set TESSERACT_CMD, "
                "or add tesseract.exe to PATH."
            )
        logger.error(f"OCR preprocessing failed: {e}")
        raise ValueError(f"OCR processing failed: {e}")


def extract_text_from_file(filename: str, content_type: str, data: bytes) -> str:
    """
    Universal file text extraction router.
    Supports: PDF, DOCX, TXT, and images (JPG, PNG, GIF, BMP, WebP)
    """
    filename_lower = filename.lower()
    content_type_lower = (content_type or "").lower()
    
    # PDF
    if filename_lower.endswith(".pdf") or "pdf" in content_type_lower:
        return _extract_text_from_pdf(data)
    
    # DOCX
    elif filename_lower.endswith(".docx") or "word" in content_type_lower or "vnd.open" in content_type_lower:
        return _extract_text_from_docx(data)
    
    # TXT
    elif filename_lower.endswith(".txt") or "text" in content_type_lower:
        return data.decode("utf-8", errors="ignore").strip()
    
    # Images - try OCR
    elif any(filename_lower.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]) \
         or "image" in content_type_lower:
        return _extract_text_from_image(data)
    
    else:
        raise ValueError(f"Unsupported file type: {filename}. Supported: PDF, DOCX, TXT, JPG, PNG, GIF, BMP, WebP")


def summarize_text(text: str, model: str = "distilbert-cnn") -> str:
    """
    Intelligent summarization router.
    Routes to BART, T5, or extractive summarizer based on model choice.
    
    Models:
    - "distilbert-cnn": BART (abstractive, high quality, slower)
    - "t5-small": T5 (abstractive, medium speed)
    - "lexrank": LexRank (extractive, very fast)
    - "combined": Multi-pass (BART chunks + extractive, balanced)
    """
    if not text or not text.strip():
        return "No content to summarize."
    
    text = text.strip()
    logger.info(f"[Summarize] Model: {model}, Input: {len(text)} chars, {len(text.split())} words")
    
    try:
        if model == "lexrank":
            # Fast extractive
            return extractive_summary(text)
        
        elif model == "t5-small" or model == "t5":
            # T5 with chunking
            return t5_summary(text)
        
        elif model == "combined":
            # Multi-pass: Extract + Abstractive blend
            extractive = extractive_summary(text)
            abstractive = bart_summary(text)
            
            # Return abstractive if it's significantly shorter and decent quality
            if len(abstractive.split()) < len(text.split()) * 0.4:
                return abstractive
            return extractive
        
        else:
            # Default to BART for distilbert-cnn and others
            return bart_summary(text)
    
    except Exception as e:
        logger.error(f"[Summarize] Error: {e}")
        # Fallback: return first paragraph
        paragraphs = text.split("\n\n")
        return paragraphs[0] if paragraphs else text[:200] + "..."


def format_summary(summary: str) -> dict:
    """Format summary with metadata."""
    return {
        "summary": summary.strip(),
        "length_chars": len(summary),
        "length_words": len(summary.split())
    }


# ── Health/Status Routes ──────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "Websears Summary Service v3"}


@app.get("/health")
def health():
    return {"status": "healthy", "version": "3.0.0"}


@app.get("/models")
def list_models():
    return {
        "available_models": [
            {"id": "distilbert-cnn", "name": "DistilBERT CNN", "type": "abstractive", "speed": "fast"},
            {"id": "t5-small", "name": "T5-Small", "type": "abstractive", "speed": "fast"},
            {"id": "lexrank", "name": "LexRank", "type": "extractive", "speed": "very fast"},
        ],
        "file_formats_supported": {
            "documents": ["pdf", "docx", "txt"],
            "images": ["jpg", "jpeg", "png", "gif", "bmp", "webp"]
        },
        "features": ["ocr", "chunking", "fallback_strategies", "timeout_handling"]
    }


# ── Core Summarization Routes ─────────────────────────────────────────────────

class TextSummarizeRequest(BaseModel):
    text: str
    model: str = "distilbert-cnn"


@app.post("/summarize/text")
def summarize_text_endpoint(req: TextSummarizeRequest):
    """Summarize plain text with specified model."""
    
    if not req.text.strip():
        raise HTTPException(400, "Text is empty")
    
    text = truncate_text(req.text.strip())
    
    try:
        logger.info(f"Summarizing {len(text)} chars with {req.model}")
        summary = summarize_text(text, model=req.model, max_time=TIMEOUT_SECONDS)
        
        return {
            "status": "success",
            "model": req.model,
            "summary": summary,
            **format_summary(summary)
        }
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(500, f"Summarization failed: {str(e)}")


@app.post("/summarize")
async def summarize(
    text: str = Form(default=""),
    file: UploadFile = File(default=None),
    model: str = Form(default="distilbert-cnn")
):
    """
    Universal summarization endpoint with intelligent routing and safeguards.
    
    Accepts:
    - Plain text input
    - PDF files
    - DOCX files
    - TXT files
    - Images (JPG, PNG, GIF, BMP, WebP) with OCR
    
    Models:
    - "distilbert-cnn": BART (high quality, slower)
    - "t5-small": T5 (medium speed)
    - "lexrank": LexRank (very fast extractive)
    - "combined": Multi-pass blend
    """
    
    extracted_text = ""
    source = "none"
    
    # Extract text from file if provided
    if file and file.filename:
        try:
            logger.info(f"Processing file: {file.filename}")
            file_data = await file.read()
            extracted_text = extract_text_from_file(file.filename, file.content_type or "", file_data)
            source = "file"
        except ValueError as e:
            raise HTTPException(400, str(e))
        except Exception as e:
            logger.error(f"File processing failed: {e}")
            raise HTTPException(500, f"Could not process file: {str(e)}")
    
    # Use direct text if no file
    elif text.strip():
        extracted_text = text
        source = "text"
    
    # Validate that we have content
    if not extracted_text.strip():
        raise HTTPException(400, "No text or file provided to summarize")
    
    # Truncate and process
    extracted_text = truncate_text(extracted_text.strip())
    
    try:
        logger.info(f"Summarizing {len(extracted_text)} chars from {source} using {model}")
        
        # Get main summary with chosen model
        summary = summarize_text(extracted_text, model=model)
        
        # Also get extractive summary for comparison in combined mode
        extractive = extractive_summary(extracted_text)
        
        return {
            "status": "success",
            "source": source,
            "model": model,
            "summary": summary,
            "extractive_summary": extractive,
            **format_summary(summary)
        }
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(500, f"Failed to generate summary: {str(e)}")


class SelectiveRequest(BaseModel):
    text: str
    model: str = "distilbert-cnn"


@app.post("/summarize/selective")
def summarize_selective(req: SelectiveRequest):
    """Summarize with choice of model."""
    
    if not req.text.strip():
        raise HTTPException(400, "Text is empty")
    
    text = truncate_text(req.text.strip())
    
    try:
        summary = summarize_text(text, model=req.model)
        
        return {
            "status": "success",
            "model": req.model,
            "summary": summary,
            **format_summary(summary)
        }
    except Exception as e:
        logger.error(f"Selective summarization failed: {e}")
        raise HTTPException(500, str(e))


class UrlRequest(BaseModel):
    text: str
    url: str = ""
    title: str = ""
    model: str = "distilbert-cnn"


@app.post("/summarize/url")
def summarize_url(req: UrlRequest):
    """Summarize extracted web page content."""
    
    if not req.text.strip():
        raise HTTPException(400, "No page text provided")
    
    text = truncate_text(req.text.strip())
    
    try:
        summary = summarize_text(text, model=req.model)
        
        return {
            "status": "success",
            "url": req.url,
            "title": req.title,
            "model": req.model,
            "summary": summary,
            **format_summary(summary)
        }
    except Exception as e:
        logger.error(f"URL summarization failed: {e}")
        raise HTTPException(500, str(e))


# ── File Upload Routes ────────────────────────────────────────────────────────

@app.post("/upload/file")
async def upload_file(
    file: UploadFile = File(...),
    model: str = Form(default="distilbert-cnn")
):
    """
    Upload any supported file format and get summary.
    Supports: PDF, DOCX, TXT, and images with OCR.
    """
    
    if not file.filename:
        raise HTTPException(400, "No file provided")
    
    try:
        logger.info(f"Uploading file: {file.filename}")
        file_data = await file.read()
        text = extract_text_from_file(file.filename, file.content_type or "", file_data)
        
        if not text.strip():
            raise HTTPException(400, "No text could be extracted from this file")
        
        text = truncate_text(text.strip())
        summary = summarize_text(text, model=model)
        
        return {
            "status": "success",
            "filename": file.filename,
            "model": model,
            "text_extracted": format_summary(text),
            "summary": summary,
            "summary_stats": format_summary(summary)
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(500, f"Could not process file: {str(e)}")


@app.post("/upload/pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    model: str = Form(default="distilbert-cnn")
):
    """Upload PDF file and generate summary."""
    
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file")
    
    try:
        file_data = await file.read()
        text = extract_text_from_file(file.filename, "application/pdf", file_data)
        
        if not text.strip():
            raise HTTPException(400, "No text could be extracted from the PDF")
        
        text = truncate_text(text.strip())
        summary = summarize_text(text, model=model, max_time=TIMEOUT_SECONDS)
        
        return {
            "status": "success",
            "filename": file.filename,
            "model": model,
            "summary": summary,
            "text_length": len(text),
            "summary_length": len(summary)
        }
    except Exception as e:
        logger.error(f"PDF upload failed: {e}")
        raise HTTPException(500, f"Could not process PDF: {str(e)}")


@app.post("/upload/image")
async def upload_image(file: UploadFile = File(...)):
    """Upload image and extract text using OCR."""
    
    if not file.filename:
        raise HTTPException(400, "No file provided")
    
    try:
        file_data = await file.read()
        text = extract_text_from_file(file.filename, file.content_type or "", file_data)
        
        return {
            "status": "success",
            "filename": file.filename,
            "extracted_text": text,
            **format_summary(text)
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"Image upload failed: {e}")
        raise HTTPException(500, f"Could not process image: {str(e)}")


# ── Error Handlers ────────────────────────────────────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return {
        "status": "error",
        "detail": exc.detail,
        "status_code": exc.status_code
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
