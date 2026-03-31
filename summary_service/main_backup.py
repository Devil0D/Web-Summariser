"""
Websears Summary Service  —  FastAPI edition
=============================================
Drop-in replacement for the original Flask main.py.
Runs on port 5001 — your Express server (chats.ts) needs NO changes.

Start with:
    uvicorn main:app --reload --port 5001
"""

from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import io, logging, warnings
import re
import pypdf  # already in your project — no new install needed

# Phase 3: Multi-format file support
try:
    from docx import Document  # python-docx for DOCX files
except ImportError:
    Document = None
    
try:
    import pytesseract  # OCR for images
    from PIL import Image  # Pillow for image processing
    # Configure pytesseract to find Tesseract-OCR on Windows
    pytesseract.pytesseract.pytesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
except ImportError:
    pytesseract = None
    Image = None


warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO)

from bart import bart_summary
from T5 import t5_summary
from extractive_summary import extractive_summary
from pdf_handler import extract_pdf_text, clean_extracted_text, get_pdf_metadata
from image_analyzer import generate_image_summary, extract_image_text, validate_image_file

app = FastAPI(
    title="Websears Summary Service",
    description="BART · T5 · LexRank summarisation API",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ───────────────────────────────────────────────────────────────────
MAX_CHARS = 50_000

def _truncate(text: str) -> str:
    if len(text) > MAX_CHARS:
        logging.warning("Input truncated to %d chars", MAX_CHARS)
    return text[:MAX_CHARS]

def _extract_pdf_text(data: bytes) -> str:
    """Extract text from PDF bytes using pypdf (already in your requirements)."""
    try:
        reader = pypdf.PdfReader(io.BytesIO(data))
        pages_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
        result = "\n".join(pages_text)
        if not result.strip():
            raise HTTPException(400, "PDF appears to be scanned/image-only — no text could be extracted.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to read PDF: {e}")

def _extract_txt_text(data: bytes) -> str:
    return data.decode("utf-8", errors="ignore")

# ── Phase 3: Extended file format support ──────────────────────────────────────

def _extract_docx_text(data: bytes) -> str:
    """Extract text from DOCX files using python-docx."""
    if Document is None:
        raise HTTPException(500, "DOCX support not installed. Install python-docx.")
    
    try:
        doc = Document(io.BytesIO(data))
        paragraphs = []
        
        # Extract text from paragraphs
        for para in doc.paragraphs:
            if para.text.strip():
                paragraphs.append(para.text)
        
        # Extract text from tables if any
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        paragraphs.append(cell.text)
        
        result = "\n".join(paragraphs)
        
        if not result.strip():
            raise HTTPException(400, "DOCX file appears to be empty — no text could be extracted.")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to read DOCX file: {e}")

def _extract_image_text(data: bytes) -> str:
    """
    Extract text from images using OCR.
    Uses pytesseract (Tesseract-OCR) for client-side processing.
    Requires Tesseract-OCR system package to be installed.
    """
    if pytesseract is None or Image is None:
        raise HTTPException(
            500, 
            "OCR support not installed. Install pytesseract and system Tesseract-OCR package."
        )
    
    try:
        # Open image from bytes
        image = Image.open(io.BytesIO(data))
        
        # Extract text using Tesseract OCR
        text = pytesseract.image_to_string(image).strip()
        
        if not text:
            return "No readable text found in the image. Please upload a clearer image or add text manually."
        
        return text
    
    except HTTPException:
        raise
    except Exception as e:
        # Return a user-friendly error message
        logging.warning(f"OCR extraction failed: {e}")
        raise HTTPException(
            400,
            "Could not extract text from image. This might be due to:\n"
            "• Image format not supported\n"
            "• Image too small or unclear\n"
            "• OCR system not configured\n"
            "\nPlease try uploading a clearer image or use a different format."
        )

def _extract_file_text(filename: str, content_type: str, data: bytes) -> str:
    """
    Universal file text extraction router.
    Determines file type and routes to appropriate extractor.
    
    Supported formats:
    • PDF (.pdf)
    • Text (.txt)
    • Word (.docx)
    • Images (.jpg, .jpeg, .png, .gif, .bmp, .webp)
    
    Returns extracted text or raises HTTPException with meaningful error.
    """
    fn = (filename or "").lower()
    ct = (content_type or "").lower()
    
    # PDF
    if fn.endswith(".pdf") or "pdf" in ct:
        return _extract_pdf_text(data)
    
    # Text file
    if fn.endswith(".txt") or "text" in ct or "plain" in ct:
        return _extract_txt_text(data)
    
    # Word document
    if fn.endswith(".docx") or "word" in ct or "document" in ct:
        return _extract_docx_text(data)
    
    # Images with OCR
    image_exts = (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp")
    if fn.endswith(image_exts) or any(img_type in ct for img_type in ["image", "jpeg", "png", "gif", "bmp", "webp"]):
        return _extract_image_text(data)
    
    # Unsupported format
    supported = "PDF, TXT, DOCX, JPG, PNG, GIF, BMP, WebP"
    raise HTTPException(
        400,
        f"Unsupported file type: {filename}\n"
        f"Supported formats: {supported}\n"
        f"\nPlease upload a file in one of the supported formats."
    )

def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()

def _split_sentences(text: str) -> list[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return []
    return [piece.strip() for piece in re.split(r"(?<=[.!?])\s+", normalized) if piece.strip()]

def _sentence_key(sentence: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", sentence.lower())

def _dedupe_sentences(text: str, *, limit: int | None = None) -> list[str]:
    unique_sentences = []
    seen = set()

    for sentence in _split_sentences(text):
        key = _sentence_key(sentence)
        if not key or key in seen:
            continue
        seen.add(key)
        unique_sentences.append(sentence)
        if limit and len(unique_sentences) >= limit:
            break

    return unique_sentences

def _combine_summaries(*summaries: str) -> str:
    merged = []
    seen = set()

    for summary in summaries:
        for sentence in _split_sentences(summary):
            key = _sentence_key(sentence)
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append(sentence)

    return " ".join(merged)

def _format_summary(raw_summary: str) -> str:
    clean_summary = _normalize_text(raw_summary)
    bullets = _dedupe_sentences(clean_summary, limit=6)

    if not bullets and clean_summary:
        bullets = [clean_summary]

    overview = bullets[0] if bullets else "No summary could be generated."
    key_points = bullets[1:] if len(bullets) > 1 else bullets

    lines = [
        "Summary Overview:",
        overview,
        "",
        "Key Points:",
    ]

    for item in key_points[:5]:
        lines.append(f"- {item}")

    return "\n".join(lines).strip()

def _build_combined(text: str):
    """Run all three models and combine — matches original Flask behaviour."""
    bart_out = _normalize_text(bart_summary(text))
    t5_out   = _normalize_text(t5_summary(text))
    lex_out  = _normalize_text(extractive_summary(text))
    combined = _combine_summaries(bart_out, t5_out, lex_out) or _normalize_text(text)
    golden_raw = _normalize_text(extractive_summary(combined))
    golden = _format_summary(golden_raw)
    return bart_out, t5_out, lex_out, golden, golden_raw


# ── routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "Websears Summary Service v2.1"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/models")
def list_models():
    return {
        "models": [
            {"id": "combined", "name": "Combined (all 3)", "type": "mixed",       "local": True},
            {"id": "bart",     "name": "BART",             "type": "abstractive", "local": True},
            {"id": "t5",       "name": "T5",               "type": "abstractive", "local": True},
            {"id": "lexrank",  "name": "LexRank",          "type": "extractive",  "local": True},
        ],
        "capabilities": {
            "text_summarization": ["bart", "t5", "lexrank", "combined"],
            "pdf_processing": ["combined", "bart", "t5", "lexrank"],
            "image_analysis": ["image-to-text-vision-model"],
            "formats_supported": {
                "text": ["txt", "plain text"],
                "documents": ["pdf"],
                "images": ["jpg", "jpeg", "png", "gif", "bmp", "webp"]
            }
        }
    }


# ── /summarize  (original endpoint — now supports multiple file types) ────────
@app.post("/summarize")
async def summarize(
    text: str        = Form(default=""),
    file: UploadFile = File(default=None),
):
    """
    Universal summarization endpoint. Supports:
    • Direct text input
    • PDF files (.pdf)
    • Text files (.txt)
    • Word documents (.docx) — Phase 3 NEW
    • Images (.jpg, .jpeg, .png, .gif, .bmp, .webp) — Phase 3 NEW with OCR
    
    Returns: { bart_summary, t5_summary, extractive_summary, final_summary }
    """
    text_to_summarize = ""

    if file and file.filename:
        raw = await file.read()
        ct  = (file.content_type or "").lower()
        fn  = (file.filename or "").lower()
        
        # Phase 3: Use universal extraction function
        text_to_summarize = _extract_file_text(fn, ct, raw)
    else:
        text_to_summarize = text

    if not text_to_summarize.strip():
        raise HTTPException(400, "No text or file provided to summarize.")

    text_to_summarize = _truncate(text_to_summarize)

    try:
        bart_out, t5_out, lex_out, golden, golden_raw = _build_combined(text_to_summarize)
    except Exception as e:
        logging.exception("Summarization failed")
        raise HTTPException(500, f"Failed to process the request: {e}")

    return {
        "bart_summary":       bart_out,
        "t5_summary":         t5_out,
        "extractive_summary": lex_out,
        "final_summary":      golden,
        "raw_final_summary":  golden_raw,
    }



# ── /summarize/selective  (extension model picker) ────────────────────────────
class SelectiveRequest(BaseModel):
    text:  str
    model: str = "combined"

@app.post("/summarize/selective")
def summarize_selective(req: SelectiveRequest):
    if not req.text.strip():
        raise HTTPException(400, "text is empty")

    text  = _truncate(req.text.strip())
    model = req.model.lower()

    try:
        if model == "bart":
            return {"summary": bart_summary(text), "model_used": "bart"}
        elif model == "t5":
            return {"summary": t5_summary(text), "model_used": "t5"}
        elif model == "lexrank":
            return {"summary": extractive_summary(text), "model_used": "lexrank"}
        elif model == "combined":
            bart_out, t5_out, lex_out, golden, golden_raw = _build_combined(text)
            return {
                "summary":            golden,
                "raw_summary":        golden_raw,
                "model_used":         "combined",
                "bart_summary":       bart_out,
                "t5_summary":         t5_out,
                "extractive_summary": lex_out,
            }
        else:
            raise HTTPException(400, f"Unknown model '{model}'. Use: bart, t5, lexrank, combined")
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Selective summarization failed")
        raise HTTPException(500, str(e))


# ── /summarize/url  (extension sends extracted page text here) ────────────────
class UrlRequest(BaseModel):
    text:  str
    url:   str
    title: str = ""
    model: str = "combined"

@app.post("/summarize/url")
def summarize_url(req: UrlRequest):
    if not req.text.strip():
        raise HTTPException(400, "No page text provided")
    return summarize_selective(SelectiveRequest(text=req.text, model=req.model))


# ── /upload/pdf  (dedicated PDF upload and summarization) ────────────────────
@app.post("/upload/pdf")
async def upload_pdf_file(
    file: UploadFile = File(...),
    model: str = Form(default="combined"),
):
    """
    Upload a PDF file, extract text, and generate summary.
    
    Parameters:
    - file: PDF file to upload
    - model: Summarization model to use (combined, bart, t5, lexrank)
    
    Returns: { summary, metadata, full_response }
    """
    if not file or not file.filename:
        raise HTTPException(400, "No file provided")
    
    # Validate file type
    fn = (file.filename or "").lower()
    ct = (file.content_type or "").lower()
    
    if not (fn.endswith(".pdf") or "pdf" in ct):
        raise HTTPException(400, "Only PDF files are supported. Upload a .pdf file.")
    
    try:
        # Read file
        pdf_data = await file.read()
        
        # Extract text from PDF
        extracted_text, pdf_metadata = extract_pdf_text(pdf_data)
        
        # Clean the extracted text
        text_to_summarize = clean_extracted_text(extracted_text)
        
        if not text_to_summarize.strip():
            raise HTTPException(400, "No text could be extracted from the PDF.")
        
        logging.info(f"PDF processed: {pdf_metadata['pages']} pages, {len(text_to_summarize)} chars")
        
        # Get full PDF metadata
        full_pdf_metadata = get_pdf_metadata(pdf_data)
        full_pdf_metadata.update(pdf_metadata)
        
        # Generate summary using selected model
        if model.lower() == "combined":
            bart_out, t5_out, lex_out, golden, golden_raw = _build_combined(text_to_summarize)
            response = {
                "filename": file.filename,
                "summary": golden,
                "raw_summary": golden_raw,
                "bart_summary": bart_out,
                "t5_summary": t5_out,
                "extractive_summary": lex_out,
                "model_used": "combined",
                "pdf_metadata": full_pdf_metadata,
                "extracted_text_preview": text_to_summarize[:200] + "..." if len(text_to_summarize) > 200 else text_to_summarize,
            }
        else:
            # Single model mode
            if model.lower() == "bart":
                summary = bart_summary(text_to_summarize)
            elif model.lower() == "t5":
                summary = t5_summary(text_to_summarize)
            elif model.lower() == "lexrank":
                summary = extractive_summary(text_to_summarize)
            else:
                raise HTTPException(400, f"Unknown model '{model}'. Use: combined, bart, t5, lexrank")
            
            response = {
                "filename": file.filename,
                "summary": summary,
                "model_used": model.lower(),
                "pdf_metadata": full_pdf_metadata,
                "extracted_text_preview": text_to_summarize[:200] + "..." if len(text_to_summarize) > 200 else text_to_summarize,
            }
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("PDF upload and summarization failed")
        raise HTTPException(500, f"Failed to process PDF: {e}")


# ── /upload/pdf/extract  (PDF text extraction only - for client-side summarization) ────
@app.post("/upload/pdf/extract")
async def extract_pdf_text_only(
    file: UploadFile = File(...),
):
    """
    Upload a PDF file and extract text ONLY (no summarization).
    Used by extension as fallback when PDF.js fails.
    
    Parameters:
    - file: PDF file to upload
    
    Returns: { text: full_extracted_text, metadata: {...} }
    """
    if not file or not file.filename:
        raise HTTPException(400, "No file provided")
    
    # Validate file type
    fn = (file.filename or "").lower()
    ct = (file.content_type or "").lower()
    
    if not (fn.endswith(".pdf") or "pdf" in ct):
        raise HTTPException(400, "Only PDF files are supported. Upload a .pdf file.")
    
    try:
        # Read file
        pdf_data = await file.read()
        
        # Extract text from PDF
        extracted_text, pdf_metadata = extract_pdf_text(pdf_data)
        
        # Clean the extracted text
        text_to_extract = clean_extracted_text(extracted_text)
        
        if not text_to_extract.strip():
            raise HTTPException(400, "No text could be extracted from the PDF.")
        
        # Get full PDF metadata
        full_pdf_metadata = get_pdf_metadata(pdf_data)
        full_pdf_metadata.update(pdf_metadata)
        
        logging.info(f"PDF extracted: {full_pdf_metadata['pages']} pages, {len(text_to_extract)} chars")
        
        return {
            "text": text_to_extract,
            "filename": file.filename,
            "metadata": full_pdf_metadata,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("PDF text extraction failed")
        raise HTTPException(500, f"Failed to extract PDF: {e}")


# ── /upload/image  (dedicated image upload and analysis) ────────────────────
@app.post("/upload/image")
async def upload_image_file(
    file: UploadFile = File(...),
):
    """
    Upload an image file and generate AI analysis.
    
    Uses lightweight vision models to analyze and describe image content.
    
    Parameters:
    - file: Image file to upload (JPEG, PNG, GIF, BMP, WebP)
    
    Returns: { short_summary, detailed_analysis, image_info, filename }
    """
    if not file or not file.filename:
        raise HTTPException(400, "No file provided")
    
    # Validate file type
    fn = (file.filename or "").lower()
    ct = (file.content_type or "").lower()
    
    if not validate_image_file(fn, ct):
        raise HTTPException(
            400,
            "Unsupported image format. Supported formats: JPEG, PNG, GIF, BMP, WebP"
        )
    
    try:
        # Read file
        image_data = await file.read()
        
        # Generate image summary
        analysis = generate_image_summary(image_data)
        
        logging.info(f"Image processed: {fn}, size: {analysis['image_info']['size']}")
        
        return {
            "filename": file.filename,
            "short_summary": analysis["short_summary"],
            "detailed_analysis": analysis["detailed_analysis"],
            "image_info": analysis["image_info"],
            "analysis_type": "image_to_text_vision_model",
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Image upload and analysis failed")
        raise HTTPException(500, f"Failed to process image: {e}")


# ── /upload/image/extract-text  (extract text from images) ───────────────────
@app.post("/upload/image/extract-text")
async def upload_image_extract_text(
    file: UploadFile = File(...),
):
    """
    Upload an image file and extract any visible text.
    
    Uses vision models to read text content from images.
    For precise OCR, install pytesseract and Tesseract-OCR system package.
    
    Parameters:
    - file: Image file to upload
    
    Returns: { content, metadata, note }
    """
    if not file or not file.filename:
        raise HTTPException(400, "No file provided")
    
    fn = (file.filename or "").lower()
    ct = (file.content_type or "").lower()
    
    if not validate_image_file(fn, ct):
        raise HTTPException(400, "Unsupported image format.")
    
    try:
        image_data = await file.read()
        result = extract_image_text(image_data)
        
        return {
            "filename": file.filename,
            **result,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Image text extraction failed")
        raise HTTPException(500, f"Failed to extract text from image: {e}")



    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
