"""
Summarizer API Bridge
=====================
Wraps your local BART, T5, and LexRank models as HTTP endpoints
so the Chrome extension (and your Flask site) can call them.

Run with:
    uvicorn api:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
import io

# ── lazy-load models so startup is fast ──────────────────────────────────────
_bart = None
_t5   = None

def get_bart():
    global _bart
    if _bart is None:
        from transformers import pipeline
        logging.info("Loading BART model…")
        _bart = pipeline(
            "summarization",
            model="facebook/bart-large-cnn",
            device=-1,          # -1 = CPU;  set 0 for GPU
        )
    return _bart

def get_t5():
    global _t5
    if _t5 is None:
        from transformers import pipeline
        logging.info("Loading T5 model…")
        _t5 = pipeline(
            "summarization",
            model="t5-base",
            device=-1,
        )
    return _t5

def run_lexrank(text: str, num_sentences: int = 5) -> str:
    """LexRank is extractive — returns top N sentences."""
    try:
        from sumy.parsers.plaintext import PlaintextParser
        from sumy.nlp.tokenizers    import Tokenizer
        from sumy.summarizers.lex_rank import LexRankSummarizer

        parser    = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = LexRankSummarizer()
        summary   = summarizer(parser.document, num_sentences)
        return " ".join(str(s) for s in summary)
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="sumy is not installed. Run: pip install sumy"
        )


# ── app setup ─────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
app = FastAPI(
    title="Summarizer API",
    description="Local BART / T5 / LexRank summarization bridge",
    version="1.0.0",
)

# Allow requests from the Chrome extension and your Flask dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── request / response schemas ────────────────────────────────────────────────
class SummarizeRequest(BaseModel):
    text:         str
    model:        str  = "bart"   # "bart" | "t5" | "lexrank" | "combined"
    max_length:   int  = 150
    min_length:   int  = 40
    num_sentences: int = 5        # only used by lexrank


class SummarizeResponse(BaseModel):
    summary:      str
    model_used:   str
    char_count_in:  int
    char_count_out: int


# ── helpers ───────────────────────────────────────────────────────────────────
MAX_CHARS = 50_000   # transformers choke on very long inputs; chunk if needed

def _truncate(text: str) -> str:
    if len(text) > MAX_CHARS:
        logging.warning("Input truncated to %d chars", MAX_CHARS)
        return text[:MAX_CHARS]
    return text

def _bart_summarize(text: str, max_length: int, min_length: int) -> str:
    result = get_bart()(
        text,
        max_length=max_length,
        min_length=min_length,
        do_sample=False,
        truncation=True,
    )
    return result[0]["summary_text"]

def _t5_summarize(text: str, max_length: int, min_length: int) -> str:
    # T5 expects "summarize: " prefix
    result = get_t5()(
        "summarize: " + text,
        max_length=max_length,
        min_length=min_length,
        do_sample=False,
        truncation=True,
    )
    return result[0]["summary_text"]


# ── routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "message": "Summarizer API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest):
    """
    Summarize text using one of the local models.

    model options:
      - "bart"     → facebook/bart-large-cnn  (abstractive)
      - "t5"       → t5-base                  (abstractive)
      - "lexrank"  → LexRank                  (extractive)
      - "combined" → runs all three, merges output
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text field is empty")

    text = _truncate(req.text.strip())
    model = req.model.lower()

    try:
        if model == "bart":
            summary = _bart_summarize(text, req.max_length, req.min_length)

        elif model == "t5":
            summary = _t5_summarize(text, req.max_length, req.min_length)

        elif model == "lexrank":
            summary = run_lexrank(text, req.num_sentences)

        elif model == "combined":
            bart_out    = _bart_summarize(text, req.max_length, req.min_length)
            t5_out      = _t5_summarize(text, req.max_length, req.min_length)
            lexrank_out = run_lexrank(text, req.num_sentences)
            summary = (
                f"[BART]\n{bart_out}\n\n"
                f"[T5]\n{t5_out}\n\n"
                f"[LexRank]\n{lexrank_out}"
            )

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown model '{model}'. Choose: bart, t5, lexrank, combined"
            )

    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Summarization failed")
        raise HTTPException(status_code=500, detail=str(exc))

    return SummarizeResponse(
        summary=summary,
        model_used=model,
        char_count_in=len(text),
        char_count_out=len(summary),
    )


@app.post("/summarize/file", response_model=SummarizeResponse)
async def summarize_file(
    file:       UploadFile = File(...),
    model:      str        = "bart",
    max_length: int        = 150,
    min_length: int        = 40,
):
    """
    Upload a .txt or .pdf file and summarize its contents.
    Accepts: text/plain, application/pdf
    """
    content_type = file.content_type or ""
    raw = await file.read()

    # ── plain text ────────────────────────────────────────────────────────────
    if "text" in content_type or file.filename.endswith(".txt"):
        text = raw.decode("utf-8", errors="ignore")

    # ── PDF ───────────────────────────────────────────────────────────────────
    elif "pdf" in content_type or file.filename.endswith(".pdf"):
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                text = "\n".join(
                    page.extract_text() or "" for page in pdf.pages
                )
        except ImportError:
            raise HTTPException(
                status_code=501,
                detail="pdfplumber not installed. Run: pip install pdfplumber"
            )
    else:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Send .txt or .pdf"
        )

    if not text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the file")

    # Reuse the same summarize logic
    fake_req = SummarizeRequest(
        text=text,
        model=model,
        max_length=max_length,
        min_length=min_length,
    )
    return summarize(fake_req)


@app.get("/models")
def list_models():
    """Returns available local models — used by the extension to populate the dropdown."""
    return {
        "models": [
            {"id": "bart",     "name": "BART",             "type": "abstractive", "local": True},
            {"id": "t5",       "name": "T5",               "type": "abstractive", "local": True},
            {"id": "lexrank",  "name": "LexRank",          "type": "extractive",  "local": True},
            {"id": "combined", "name": "Combined (all 3)", "type": "mixed",       "local": True},
        ]
    }
