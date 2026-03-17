from transformers import pipeline, logging
import torch
import warnings

warnings.filterwarnings("ignore")
logging.set_verbosity_error()

device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
summarizer = pipeline("summarization", model="facebook/bart-large-cnn", device=device)

# BART-large-cnn hard limit is 1024 tokens ≈ 700–750 words
BART_MAX_WORDS = 700

def _chunk_text(text: str, max_words: int = BART_MAX_WORDS) -> list[str]:
    """Split text into chunks that fit within BART's token limit."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), max_words):
        chunk = " ".join(words[i : i + max_words])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


def bart_summary(text: str) -> str:
    if not text or not text.strip():
        return "No content to summarize."

    words = text.split()
    input_length = len(words)

    # If text fits in one chunk, summarize directly
    if input_length <= BART_MAX_WORDS:
        min_len = max(25, input_length // 4)
        max_len = max(min_len + 20, min(150, input_length // 2))  # cap at 150
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
            return f"Summarization failed: {e}"

    # For long text: summarize each chunk, then summarize the combined summaries
    chunks = _chunk_text(text, BART_MAX_WORDS)
    chunk_summaries = []

    for chunk in chunks:
        chunk_words = len(chunk.split())
        min_len = max(20, chunk_words // 5)
        max_len = max(min_len + 15, min(100, chunk_words // 3))
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
        except Exception as e:
            # Skip bad chunks rather than failing the whole request
            print(f"[BART] Chunk failed, skipping: {e}")
            continue

    if not chunk_summaries:
        return "Could not generate a summary from the provided text."

    # If we got multiple chunk summaries, do a final summarization pass
    combined = " ".join(chunk_summaries)
    combined_words = len(combined.split())

    if combined_words <= BART_MAX_WORDS:
        min_len = max(25, combined_words // 4)
        max_len = max(min_len + 20, min(200, combined_words // 2))
        try:
            result = summarizer(
                combined,
                max_length=max_len,
                min_length=min_len,
                do_sample=False,
                truncation=True,
            )
            return result[0]["summary_text"] if result else combined
        except Exception:
            return combined
    else:
        # Combined is still too long — return joined chunk summaries as-is
        return combined
