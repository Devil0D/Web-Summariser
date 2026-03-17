from transformers import pipeline, logging
import torch
import warnings

warnings.filterwarnings("ignore")
logging.set_verbosity_error()

# 1. Load the model only ONCE when the script starts.
#    This also checks if a GPU is available.
device = "cuda:0" if torch.cuda.is_available() else "cpu"
summarizer = pipeline(
    "summarization",
    model="t5-base",
    device=device
)

T5_MAX_WORDS = 300

def _chunk_text(text: str, max_words: int = T5_MAX_WORDS) -> list:
    """Split text into word-count chunks safe for T5."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), max_words):
        chunk = " ".join(words[i : i + max_words])
        if chunk.strip():
            chunks.append(chunk)
    return chunks

def t5_summary(text: str) -> str:
    """Summarise text with T5-base, handling long inputs via chunking."""
    if not text or not text.strip():
        return "No content to summarize."

    words = text.split()
    input_length = len(words)

    if input_length <= T5_MAX_WORDS:
        # Short enough for a single pass
        min_len = max(20, input_length // 5)
        max_len = max(min_len + 15, min(120, input_length // 3))
        try:
            result = summarizer(
                text,
                max_length=max_len,
                min_length=min_len,
                do_sample=False,
                truncation=True,
            )
            return result[0]["summary_text"] if result else "Could not generate summary."
        except Exception as e:
            return f"T5 summarization failed: {e}"

    # Long text — summarise each chunk, then do a final pass
    chunks = _chunk_text(text, T5_MAX_WORDS)
    chunk_summaries = []

    for chunk in chunks:
        chunk_words = len(chunk.split())
        min_len = max(15, chunk_words // 6)
        max_len = max(min_len + 10, min(80, chunk_words // 4))
        try:
            result = summarizer(
                chunk,
                max_length=max_len,
                min_length=min_len,
                do_sample=False,
                truncation=True,
            )
            if result:
                chunk_summaries.append(result[0]["summary_text"])
        except Exception:
            continue

    if not chunk_summaries:
        return "Could not generate summary."

    combined = " ".join(chunk_summaries)
    combined_words = len(combined.split())

    # Final condensation pass if combined fits in one chunk
    if combined_words <= T5_MAX_WORDS:
        min_len = max(20, combined_words // 5)
        max_len = max(min_len + 15, min(120, combined_words // 3))
        try:
            final = summarizer(
                combined,
                max_length=max_len,
                min_length=min_len,
                do_sample=False,
                truncation=True,
            )
            return final[0]["summary_text"] if final else combined
        except Exception:
            return combined

    return combined
    
def safe_summary(text:str)->str:
    if not text or len(text.strip())==0:
        return "No content to summarize"
    
    input_length=len(text.split())

    min_len=min(100,max(10,input_length//4))
    max_len=max(512,max(min_len+20,input_length//2))

    print("Extracted text length (words):", input_length)
    print("First 300 chars:", text[:300])

    try:
        summary=summarizer(
          text,
          max_length=max_len,
          min_length=min_len,
          do_sample=False
        )
        return summary[0]["summary_text"] if summary else "could not generate a summary"
    except Exception as e:
        return f"Summarization failed:{e}"
