from transformers import pipeline, logging
import torch
import warnings
import re

warnings.filterwarnings("ignore")
logging.set_verbosity_error()

device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
summarizer = pipeline("summarization", model="facebook/bart-large-cnn", device=device)

# BART-large-cnn token limit is 1024 tokens (optimized: ~550 words, practical sweet spot)
BART_MAX_WORDS = 550
BART_MIN_WORDS = 30
BART_MIN_SUMMARY = 20
BART_MAX_SUMMARY = 95

def _split_sentences(text: str) -> list[str]:
    """Split text into sentences for better chunking."""
    # Simple sentence splitting on . ! ?
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]

def _chunk_text(text: str, max_words: int = BART_MAX_WORDS) -> list[str]:
    """
    Intelligently chunk text while respecting sentence boundaries.
    Tries to keep sentences together to preserve meaning.
    """
    sentences = _split_sentences(text)
    if not sentences:
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
    current_word_count = 0
    
    for sentence in sentences:
        sentence_words = len(sentence.split())
        
        # If single sentence exceeds max, split it by words
        if sentence_words > max_words:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_word_count = 0
            
            # Split large sentence by words
            words = sentence.split()
            for i in range(0, len(words), max_words):
                chunk_words = words[i : i + max_words]
                chunks.append(" ".join(chunk_words))
        # If adding this sentence exceeds limit, start new chunk
        elif current_word_count + sentence_words > max_words:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
            current_chunk = [sentence]
            current_word_count = sentence_words
        # Add to current chunk
        else:
            current_chunk.append(sentence)
            current_word_count += sentence_words
    
    # Don't forget last chunk
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return [c for c in chunks if c.strip()]

def _calculate_summary_lengths(text_words: int) -> tuple[int, int]:
    """
    Calculate optimal min and max summary lengths.
    Preserves more detail for long-form content (novels, articles).
    """
    # Very short text - minimal reduction
    if text_words < 50:
        min_len = max(10, text_words // 8)
        max_len = max(min_len + 15, text_words // 2.5)
    
    # Short text
    elif text_words < 150:
        min_len = max(15, text_words // 10)
        max_len = max(min_len + 18, text_words // 2.2)
    
    # Medium text  
    elif text_words < 350:
        min_len = max(20, text_words // 12)
        max_len = max(min_len + 25, text_words // 2)
    
    # Long text (550 word chunks for novels/articles)
    else:
        min_len = max(30, min(50, text_words // 18))
        max_len = max(min_len + 35, min(165, int(text_words * 0.45)))  # 45% retention
    
    # Safety checks
    if max_len <= min_len:
        max_len = min_len + 40
    
    min_len = max(3, min(100, min_len))
    max_len = max(min_len + 1, min(190, max_len))
    
    return min_len, max_len
    
    # Ensure minimum gap to prevent model errors
    if max_len <= min_len:
        max_len = min_len + 30
    
    # Hard limits to prevent model crash
    min_len = max(3, min(100, min_len))
    max_len = max(min_len + 1, min(190, max_len))
    
    return min_len, max_len

def _safe_summarize(text: str, reduction_ratio: float = 0.5) -> str:
    """
    Safely summarize text with intelligent parameter selection and error recovery.
    
    Args:
        text: Input text to summarize
        reduction_ratio: Target reduction (0.5 = 50% of original)
    
    Returns:
        Summarized text or original if too short/error
    """
    try:
        text_words = len(text.split())
        
        # Too short to summarize meaningfully
        if text_words < 20:
            print(f"[BART] Text too short ({text_words} words), skipping summarization")
            return text
        
        # Calculate safe lengths with multi-step validation
        min_len, max_len = _calculate_summary_lengths(text_words)
        
        print(f"[BART] Summarizing {text_words} words -> target {min_len}-{max_len}")
        
        # Pre-validate parameters one more time before calling model
        assert min_len < max_len, f"Invalid bounds: min={min_len}, max={max_len}"
        assert min_len >= 1, f"min_len too small: {min_len}"
        assert max_len <= 200, f"max_len too large: {max_len}"
        
        result = summarizer(
            text,
            max_length=max_len,
            min_length=min_len,
            do_sample=False,
            truncation=True,
        )
        
        if not result:
            print(f"[BART] Model returned empty result, returning truncated text")
            words = text.split()
            return " ".join(words[:max(20, len(words) // 3)])
        
        summary = result[0]["summary_text"]
        summary_words = len(summary.split())
        print(f"[BART] Result: {summary_words} words (reduction: {summary_words/text_words*100:.1f}%)")
        
        return summary
        
    except AssertionError as e:
        print(f"[BART] Assertion error (parameter validation): {e}")
        # Return first 1/3 of text as fallback
        words = text.split()
        return " ".join(words[:max(20, len(words) // 3)])
    
    except IndexError as e:
        print(f"[BART] IndexError (token mismatch): {e}")
        # Model tokenizer produced fewer tokens than expected - return original text
        return text
    
    except Exception as e:
        print(f"[BART] Error during summarization: {type(e).__name__}: {e}")
        # Fallback: return first 50% of text
        words = text.split()
        return " ".join(words[:max(len(words) // 2, 20)])

def bart_summary(text: str) -> str:
    """
    Multi-pass BART summarization with intelligent chunking.
    
    Strategy:
    1. If text is short (< 30 words): return as-is
    2. If text fits in one chunk: summarize directly
    3. If text is long: chunk -> summarize each -> combine -> final pass
    """
    if not text or not text.strip():
        return "No content to summarize."

    text = text.strip()
    words = text.split()
    input_length = len(words)

    print(f"[BART] Starting summarization: {input_length} words")

    # Too short to summarize
    if input_length < BART_MIN_WORDS:
        print(f"[BART] Text too short ({input_length} < {BART_MIN_WORDS}), returning as-is")
        return text

    # Single pass: text fits in one chunk
    if input_length <= BART_MAX_WORDS:
        print(f"[BART] Single pass (fits in {BART_MAX_WORDS} words)")
        return _safe_summarize(text)

    # Multi-pass: chunk, summarize each, then combine
    print(f"[BART] Multi-pass: chunking text (chunk size: {BART_MAX_WORDS})")
    chunks = _chunk_text(text, BART_MAX_WORDS)
    print(f"[BART] Created {len(chunks)} chunks")
    
    chunk_summaries = []
    for i, chunk in enumerate(chunks):
        chunk_words = len(chunk.split())
        print(f"[BART] Processing chunk {i+1}/{len(chunks)} ({chunk_words} words)")
        
        # Skip tiny chunks
        if chunk_words < 20:
            print(f"[BART] Chunk {i+1} too small, keeping first sentence")
            # Take first sentence only
            sentences = _split_sentences(chunk)
            chunk_summaries.append(sentences[0] if sentences else chunk[:100])
            continue
        
        summary = _safe_summarize(chunk)
        chunk_summaries.append(summary)

    if not chunk_summaries:
        print("[BART] No summaries generated")
        return "Could not generate a summary from the provided text."

    # Combine summaries
    combined = " ".join(chunk_summaries)
    combined_words = len(combined.split())
    print(f"[BART] Combined summaries: {combined_words} words from {len(chunk_summaries)} chunks")

    # Final pass if combined text is still reasonable
    if combined_words <= BART_MAX_WORDS:
        print("[BART] Final summarization pass")
        final_summary = _safe_summarize(combined)
        print(f"[BART] Final result: {len(final_summary.split())} words")
        return final_summary
    else:
        # Already reasonably summarized, just truncate if needed
        print(f"[BART] Combined still long ({combined_words} words), returning as-is")
        max_summary_words = 220  # Increased for better detail in long content
        words_list = combined.split()
        if len(words_list) > max_summary_words:
            return " ".join(words_list[:max_summary_words]) + "..."
        return combined
