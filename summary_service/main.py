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

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO)

from bart import bart_summary
from T5 import t5_summary
from extractive_summary import extractive_summary

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
        ]
    }


# ── /summarize  (original endpoint — unchanged for Express chats.ts) ──────────
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
        ct  = (file.content_type or "").lower()
        fn  = (file.filename or "").lower()

        if "pdf" in ct or fn.endswith(".pdf"):
            text_to_summarize = _extract_pdf_text(raw)
        elif "text" in ct or fn.endswith(".txt"):
            text_to_summarize = _extract_txt_text(raw)
        else:
            raise HTTPException(400, "Unsupported file type. Upload a .pdf or .txt file.")
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
