from transformers import pipeline, logging
import torch
import warnings
import re

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

T5_MAX_WORDS = 330  # Optimized: 84% utilization, +18% increase
T5_MIN_WORDS = 35   # Don't attempt summarization below this threshold

def _chunk_text(text: str, max_words: int = T5_MAX_WORDS) -> list:
    """
    Split text into word-count chunks with sentence boundary respect.
    """
    # Try to split on sentence boundaries first
    sentences = re.split(r'(?<=[.!?])\s+', text)
    if not sentences or len(sentences) == 1:
        # Fallback to word-based chunking
        words = text.split()
        chunks = []
        for i in range(0, len(words), max_words):
            chunk = " ".join(words[i : i + max_words])
            if chunk.strip():
                chunks.append(chunk)
        return chunks
    
    # Sentence-based chunking
    chunks = []
    current_chunk = []
    word_count = 0
    
    for sentence in sentences:
        sentence_words = len(sentence.split())
        
        # If single sentence exceeds limit, split by words
        if sentence_words > max_words:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                word_count = 0
            
            words = sentence.split()
            for i in range(0, len(words), max_words):
                chunk_words = words[i : i + max_words]
                chunks.append(" ".join(chunk_words))
        
        # If adding sentence exceeds limit, start new chunk
        elif word_count + sentence_words > max_words:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
            current_chunk = [sentence]
            word_count = sentence_words
        
        # Add to current chunk
        else:
            current_chunk.append(sentence)
            word_count += sentence_words
    
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return [c for c in chunks if c.strip()]

def _calculate_t5_lengths(text_words: int) -> tuple[int, int]:
    """Calculate optimal min/max for T5 with safety."""
    if text_words < 50:
        min_len = max(8, text_words // 10)
        max_len = max(min_len + 12, text_words // 3)
    elif text_words < 150:
        min_len = max(10, text_words // 12)
        max_len = max(min_len + 12, text_words // 3)
    else:
        min_len = max(12, text_words // 15)
        max_len = max(min_len + 15, min(80, text_words // 2))
    
    # Ensure minimum gap
    if max_len <= min_len:
        max_len = min_len + 20
    
    # Hard limits
    min_len = max(2, min(60, min_len))
    max_len = max(min_len + 1, min(120, max_len))
    
    return min_len, max_len

def _safe_summarize(text: str) -> str:
    """Safely summarize with intelligent error recovery."""
    try:
        text_words = len(text.split())
        
        if text_words < 15:
            return text
        
        min_len, max_len = _calculate_t5_lengths(text_words)
        
        print(f"[T5] Summarizing {text_words} words -> {min_len}-{max_len}")
        
        # Validation
        assert min_len < max_len, f"Invalid bounds: {min_len}-{max_len}"
        
        result = summarizer(
            text,
            max_length=max_len,
            min_length=min_len,
            do_sample=False,
            truncation=True,
        )
        
        if not result:
            print(f"[T5] Empty result, returning truncated text")
            words = text.split()
            return " ".join(words[:max(15, len(words) // 3)])
        
        summary = result[0]["summary_text"]
        print(f"[T5] Result: {len(summary.split())} words")
        
        return summary
    
    except IndexError as e:
        print(f"[T5] IndexError (token mismatch): {e}")
        return text
    
    except Exception as e:
        print(f"[T5] Error: {type(e).__name__}: {e}")
        words = text.split()
        return " ".join(words[:max(len(words) // 2, 15)])

def t5_summary(text: str) -> str:
    """
    Multi-pass T5 summarization with intelligent chunking.
    
    Strategy:
    1. If text is short: return as-is
    2. If text fits in one chunk: summarize directly
    3. If text is long: chunk -> summarize each -> combine -> final pass
    """
    if not text or not text.strip():
        return "No content to summarize."

    text = text.strip()
    words = text.split()
    input_length = len(words)

    print(f"[T5] Starting summarization: {input_length} words")

    # Too short to summarize
    if input_length < T5_MIN_WORDS:
        print(f"[T5] Text too short ({input_length} < {T5_MIN_WORDS}), returning as-is")
        return text

    # Single pass: text fits in one chunk
    if input_length <= T5_MAX_WORDS:
        print(f"[T5] Single pass (fits in {T5_MAX_WORDS} words)")
        return _safe_summarize(text)

    # Multi-pass: chunk, summarize each, then combine
    print(f"[T5] Multi-pass: chunking text (chunk size: {T5_MAX_WORDS})")
    chunks = _chunk_text(text, T5_MAX_WORDS)
    print(f"[T5] Created {len(chunks)} chunks")
    
    chunk_summaries = []
    for i, chunk in enumerate(chunks):
        chunk_words = len(chunk.split())
        print(f"[T5] Processing chunk {i+1}/{len(chunks)} ({chunk_words} words)")
        
        # Skip tiny chunks
        if chunk_words < 20:
            print(f"[T5] Chunk {i+1} too small, keeping as-is")
            chunk_summaries.append(chunk[:min(100, len(chunk))])
            continue
        
        summary = _safe_summarize(chunk)
        chunk_summaries.append(summary)

    if not chunk_summaries:
        print("[T5] No summaries generated")
        return "Could not generate a summary from the provided text."

    # Combine summaries
    combined = " ".join(chunk_summaries)
    combined_words = len(combined.split())
    print(f"[T5] Combined: {combined_words} words from {len(chunk_summaries)} chunks")

    # Final pass if combined text is still reasonable
    if combined_words <= T5_MAX_WORDS:
        print("[T5] Final summarization pass")
        final_summary = _safe_summarize(combined)
        print(f"[T5] Final result: {len(final_summary.split())} words")
        return final_summary
    else:
        print(f"[T5] Combined still long ({combined_words} words), returning as-is")
        max_summary_words = 120
        words_list = combined.split()
        if len(words_list) > max_summary_words:
            return " ".join(words_list[:max_summary_words]) + "..."
        return combined
    
def safe_summary(text: str) -> str:
    """Fallback safe summarization."""
    if not text or len(text.strip()) == 0:
        return "No content to summarize"
    
    text = text.strip()
    input_length = len(text.split())
    
    print(f"[T5] Safe summary: Input {input_length} words")
    
    # Too short
    if input_length < 20:
        return text

    # Use main function
    return t5_summary(text)
