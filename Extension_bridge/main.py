"""
Websears Summary Service  —  FastAPI edition
=============================================
Drop-in replacement for the original Flask main.py.
Runs on port 5001 — your Express server (chats.ts) needs NO changes.

New features vs the old Flask version:
  • /summarize/selective  — choose which model(s) to run
  • /summarize/url        — fetch a URL and summarise it (for the extension)
  • /models               — model list for the extension dropdown
  • /health               — ping endpoint for the extension status indicator
  • CORS open for Chrome extension + localhost:5173

Start with:
    uvicorn main:app --reload --port 5001
"""

from fastapi import FastAPI, Form, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import io, logging, warnings

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO)

# ── import your existing model modules ────────────────────────────────────────
from bart import bart_summary
from T5 import t5_summary
from extractive_summary import extractive_summary

# Llama model detector (from summary_service)
try:
    from llama_detector import detect_llama_models, get_system_prompt, validate_model
except ImportError:
    # Fallback if not in same directory
    import sys
    sys.path.insert(0, '../summary_service')
    from llama_detector import detect_llama_models, get_system_prompt, validate_model

# ── app ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Websears Summary Service",
    description="BART · T5 · LexRank summarisation API",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Chrome extension + your dev servers
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
    try:
        import pypdf, io as _io
        reader = pypdf.PdfReader(_io.BytesIO(data))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
    except ImportError:
        raise HTTPException(501, "pypdf not installed — run: pip install pypdf")

def _extract_txt_text(data: bytes) -> str:
    return data.decode("utf-8", errors="ignore")

def _build_combined(text: str):
    """Run all three models and combine — matches original Flask behaviour."""
    bart_out = bart_summary(text)
    t5_out   = t5_summary(text)
    lex_out  = extractive_summary(text)
    combined = f"{bart_out} {t5_out} {lex_out}"
    golden   = extractive_summary(combined)
    return bart_out, t5_out, lex_out, golden


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "ok", "service": "Websears Summary Service v2"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/models")
def list_models():
    """Extension calls this to build the model-selector dropdown."""
    return {
        "models": [
            {"id": "combined",  "name": "Combined (all 3)",  "type": "mixed",       "local": True},
            {"id": "bart",      "name": "BART",              "type": "abstractive", "local": True},
            {"id": "t5",        "name": "T5",                "type": "abstractive", "local": True},
            {"id": "lexrank",   "name": "LexRank",           "type": "extractive",  "local": True},
        ]
    }


# ── Llama Model Detection Routes ──────────────────────────────────────────────

@app.get("/llama/detect")
def detect_llama():
    """
    Detect which Llama models are available via Ollama.
    Returns available models and the recommended one to use.
    """
    result = detect_llama_models()
    return result


@app.get("/llama/models")
def get_llama_models():
    """Get list of available Llama models."""
    result = detect_llama_models()
    return {
        "available_models": result.get("available", []),
        "recommended_model": result.get("recommended"),
        "status": result.get("status"),
        "error": result.get("error")
    }


@app.get("/llama/system-prompt/{model_name}")
def get_llama_system_prompt(model_name: str):
    """Get the optimized system prompt for a specific Llama model."""
    prompt = get_system_prompt(model_name)
    return {
        "model": model_name,
        "system_prompt": prompt,
        "available_models": ["llama3.2", "llama3"]
    }


@app.get("/llama/validate")
def validate_llama_model(model: str = "llama3.2"):
    """
    Validate if a specific Llama model exists and is installed.
    
    Query parameter:
    - model: "llama3.2" (default) or "llama3"
    """
    model = model.lower()
    is_valid = validate_model(model)
    
    return {
        "model": model,
        "is_available": is_valid,
        "detection_info": detect_llama_models()
    }


# ── /summarize  (original endpoint — multipart form, unchanged for Express) ──
@app.post("/summarize")
async def summarize(
    text: str        = Form(default=""),
    file: UploadFile = File(default=None),
):
    """
    Identical contract to the original Flask route so chats.ts needs no edits.
    Returns: { bart_summary, t5_summary, extractive_summary, final_summary }
    """
    text_to_summarize = ""

    if file and file.filename:
        raw = await file.read()
        if file.content_type == "application/pdf" or file.filename.endswith(".pdf"):
            text_to_summarize = _extract_pdf_text(raw)
        elif "text" in (file.content_type or "") or file.filename.endswith(".txt"):
            text_to_summarize = _extract_txt_text(raw)
        else:
            raise HTTPException(400, "Invalid file type. Please upload a PDF or .txt file.")
    else:
        text_to_summarize = text

    if not text_to_summarize.strip():
        raise HTTPException(400, "No text or file provided to summarize.")

    text_to_summarize = _truncate(text_to_summarize)

    try:
        bart_out, t5_out, lex_out, golden = _build_combined(text_to_summarize)
    except Exception as e:
        logging.exception("Summarization failed")
        raise HTTPException(500, f"Failed to process the request: {e}")

    return {
        "bart_summary":       bart_out,
        "t5_summary":         t5_out,
        "extractive_summary": lex_out,
        "final_summary":      golden,
    }


# ── /summarize/selective  (new — for the extension model picker) ──────────────
class SelectiveRequest(BaseModel):
    text:  str
    model: str = "combined"   # "bart" | "t5" | "lexrank" | "combined"


@app.post("/summarize/selective")
def summarize_selective(req: SelectiveRequest):
    """
    Called by the Chrome extension when the user picks a specific model.
    Returns a single `summary` string plus per-model outputs when combined.
    """
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
            bart_out, t5_out, lex_out, golden = _build_combined(text)
            return {
                "summary":            golden,
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


# ── /summarize/url  (new — extension grabs page text and sends it here) ───────
class UrlRequest(BaseModel):
    text:  str          # page text extracted by the content script
    url:   str          # original URL (for metadata only)
    title: str = ""     # page title
    model: str = "combined"


@app.post("/summarize/url")
def summarize_url(req: UrlRequest):
    """
    The extension's content script strips the page to plain text and POSTs it.
    Returns same shape as /summarize/selective.
    """
    if not req.text.strip():
        raise HTTPException(400, "No page text provided")

    # Reuse selective logic
    return summarize_selective(
        SelectiveRequest(text=req.text, model=req.model)
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
