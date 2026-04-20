from transformers import BartForConditionalGeneration, BartTokenizer, logging
import torch
import warnings
import re
import time
from datetime import datetime

# Suppress warnings from transformers and tokenizers
warnings.filterwarnings("ignore")
logging.set_verbosity_error()

# ── Logging Utilities ──────────────────────────────────────────────────────────
def log_batch(stage: str, batch_info: dict):
    """Log batch processing information to terminal."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    info_str = " | ".join([f"{k}: {v}" for k, v in batch_info.items()])
    print(f"[{timestamp}] [BART] {stage}: {info_str}")

# Initialize BART with GPU support if available
device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
model_name = "facebook/bart-large-cnn"
tokenizer = BartTokenizer.from_pretrained(model_name)
model = BartForConditionalGeneration.from_pretrained(model_name).to(device)
# Enable fp16 (half-precision) for faster inference on CUDA
if torch.cuda.is_available():
    model = model.half()
model.eval()

# BART-large-cnn token limit is 1024 tokens (optimized: ~650 words for faster batch processing)
BART_MAX_WORDS = 650
BART_MIN_WORDS = 30
BART_MIN_SUMMARY = 20
BART_MAX_SUMMARY = 110  # Increased from 95 for better summary quality with greedy decoding

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
    Preserves 40-55% of content for better information retention.
    """
    # Very short text - keep 60-75% of content
    if text_words < 50:
        min_len = max(15, int(text_words * 0.60))
        max_len = max(min_len + 15, int(text_words * 0.75))
    
    # Short text - keep 50-65% of content
    elif text_words < 150:
        min_len = max(20, int(text_words * 0.50))
        max_len = max(min_len + 18, int(text_words * 0.65))
    
    # Medium text - keep 45-60% of content
    elif text_words < 350:
        min_len = max(30, int(text_words * 0.45))
        max_len = max(min_len + 25, int(text_words * 0.60))
    
    # Long text (550 word chunks) - keep 40-55% of content
    else:
        min_len = max(40, int(text_words * 0.40))
        max_len = max(min_len + 35, min(180, int(text_words * 0.55)))
    
    # Safety checks
    if max_len <= min_len:
        max_len = min_len + 35
    
    min_len = max(10, min(120, min_len))
    max_len = max(min_len + 1, min(200, max_len))
    
    return min_len, max_len

def _safe_summarize(text: str, reduction_ratio: float = 0.5) -> str:
    """
    Safely summarize text with intelligent parameter selection and error recovery.
    Uses direct model API instead of pipeline for better compatibility.
    
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
        
        # Tokenize input
        inputs = tokenizer.encode(text, return_tensors="pt", max_length=1024, truncation=True).to(device)
        
        # Generate summary using greedy decoding with temperature for speed and accuracy
        with torch.no_grad():
            summary_ids = model.generate(
                inputs,
                max_length=max_len,
                min_length=min_len,
                num_beams=1,  # Greedy decoding: 4-8x faster than beam search
                early_stopping=True,
                do_sample=True,  # Enable sampling for better diversity
                temperature=0.7,  # Controlled randomness for accuracy
                top_k=50,  # Reduce vocabulary for faster selection
                top_p=0.95,  # Nucleus sampling for quality
                length_penalty=2.0  # Encourage longer summaries
            )
            # Clear GPU cache to prevent memory buildup
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        
        # Decode summary
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        
        if not summary or summary.strip() == "":
            print(f"[BART] Model returned empty result, returning truncated text")
            words = text.split()
            return " ".join(words[:max(20, len(words) // 3)])
        
        summary_words = len(summary.split())
        print(f"[BART] Result: {summary_words} words (reduction: {summary_words/text_words*100:.1f}%)")
        
        return summary
        
    except AssertionError as e:
        print(f"[BART] Assertion error (parameter validation): {e}")
        # Return first 1/3 of text as fallback
        words = text.split()
        return " ".join(words[:max(20, len(words) // 3)])
    
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

    start_time = time.time()
    text = text.strip()
    words = text.split()
    input_length = len(words)

    log_batch("INIT", {"words": input_length, "chars": len(text)})

    # Too short to summarize
    if input_length < BART_MIN_WORDS:
        log_batch("SKIP", {"reason": "text_too_short", "words": input_length, "min_required": BART_MIN_WORDS})
        return text

    # Single pass: text fits in one chunk
    if input_length <= BART_MAX_WORDS:
        log_batch("MODE", {"type": "single_pass", "words": input_length, "chunk_size": BART_MAX_WORDS})
        result = _safe_summarize(text)
        elapsed = time.time() - start_time
        output_words = len(result.split())
        log_batch("COMPLETE", {"input": input_length, "output": output_words, "reduction": f"{(1-output_words/input_length)*100:.1f}%", "time": f"{elapsed:.2f}s"})
        return result

    # Multi-pass: chunk, summarize each, then combine
    log_batch("MODE", {"type": "multi_pass", "chunk_size": BART_MAX_WORDS})
    chunks = _chunk_text(text, BART_MAX_WORDS)
    log_batch("CHUNKING", {"total_chunks": len(chunks), "chunk_size": BART_MAX_WORDS})
    
    chunk_summaries = []
    chunk_stats = []
    
    for i, chunk in enumerate(chunks):
        chunk_words = len(chunk.split())
        chunk_progress = f"{i+1}/{len(chunks)}"
        log_batch(f"BATCH_{chunk_progress}", {"chunk_words": chunk_words, "status": "processing"})
        
        # Skip tiny chunks
        if chunk_words < 20:
            log_batch(f"BATCH_{chunk_progress}", {"chunk_words": chunk_words, "status": "skipped_small"})
            sentences = _split_sentences(chunk)
            chunk_summaries.append(sentences[0] if sentences else chunk[:100])
            chunk_stats.append({"chunk": i+1, "input": chunk_words, "output": len((sentences[0] if sentences else chunk[:100]).split()), "type": "small_kept_as_is"})
            continue
        
        summary = _safe_summarize(chunk)
        summary_words = len(summary.split())
        log_batch(f"BATCH_{chunk_progress}", {"chunk_words": chunk_words, "summary_words": summary_words, "status": "completed"})
        chunk_summaries.append(summary)
        chunk_stats.append({"chunk": i+1, "input": chunk_words, "output": summary_words})

    if not chunk_summaries:
        log_batch("ERROR", {"stage": "chunk_summarization", "reason": "no_summaries"})
        return "Could not generate a summary from the provided text."

    # Combine summaries
    combined = " ".join(chunk_summaries)
    combined_words = len(combined.split())
    log_batch("COMBINE", {"total_summaries": len(chunk_summaries), "combined_words": combined_words})

    # Minimal logging for speed (skip expensive table printing)
    total_input = sum(s["input"] for s in chunk_stats)
    total_output = sum(s["output"] for s in chunk_stats)
    avg_reduction = f"{(1 - total_output/total_input)*100:.1f}%" if total_input > 0 else "N/A"
    log_batch("STATS", {"total_input": total_input, "total_output": total_output, "avg_reduction": avg_reduction})

    # Final pass if combined text is still reasonable
    if combined_words <= BART_MAX_WORDS:
        log_batch("FINAL", {"status": "single_pass", "words": combined_words})
        final_summary = _safe_summarize(combined)
        final_words = len(final_summary.split())
        elapsed = time.time() - start_time
        overall_reduction = f"{(1 - final_words/input_length)*100:.1f}%"
        log_batch("COMPLETE", {"input": input_length, "output": final_words, "overall_reduction": overall_reduction, "time": f"{elapsed:.2f}s"})
        return final_summary
    else:
        # Already reasonably summarized, just truncate if needed
        print(f"[BART] Combined still long ({combined_words} words), returning as-is")
        max_summary_words = 220  # Increased for better detail in long content
        words_list = combined.split()
        if len(words_list) > max_summary_words:
            return " ".join(words_list[:max_summary_words]) + "..."
        return combined
