from transformers import T5ForConditionalGeneration, T5Tokenizer, logging
import torch
import warnings
import re
import time
from datetime import datetime

warnings.filterwarnings("ignore")
logging.set_verbosity_error()

# ── Logging Utilities ──────────────────────────────────────────────────────────
def log_batch(stage: str, batch_info: dict):
    """Log batch processing information to terminal."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    info_str = " | ".join([f"{k}: {v}" for k, v in batch_info.items()])
    print(f"[{timestamp}] [T5] {stage}: {info_str}")

# Load T5 model and tokenizer with GPU support
device = "cuda:0" if torch.cuda.is_available() else "cpu"
model_name = "google/flan-t5-base"
tokenizer = T5Tokenizer.from_pretrained(model_name)
model = T5ForConditionalGeneration.from_pretrained(model_name).to(device)
# Enable fp16 (half-precision) for faster inference on CUDA
if torch.cuda.is_available():
    model = model.half()
model.eval()

T5_MAX_WORDS = 600  # Increased for faster batch processing (greedy decoding handles larger chunks)
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
    """Calculate optimal min/max for T5 with better content preservation and timeout prevention."""
    # Goal: Keep 35-50% of content for most texts - more aggressive to avoid timeouts
    if text_words < 50:
        # Very short text: keep 60-70% of content
        min_len = max(12, int(text_words * 0.60))
        max_len = max(min_len + 8, int(text_words * 0.75))
    elif text_words < 150:
        # Short text: keep 40-55% of content
        min_len = max(15, int(text_words * 0.40))
        max_len = max(min_len + 10, int(text_words * 0.55))
    elif text_words < 300:
        # Medium text: keep 35-50% of content
        min_len = max(20, int(text_words * 0.35))
        max_len = max(min_len + 12, int(text_words * 0.50))
    else:
        # Long text: keep 30-45% of content (more aggressive to prevent timeouts)
        min_len = max(30, int(text_words * 0.30))
        max_len = max(min_len + 15, min(120, int(text_words * 0.45)))
    
    # Ensure minimum gap and reasonable bounds
    if max_len <= min_len:
        max_len = min_len + 12
    
    # Hard limits - reduced to prevent timeouts
    min_len = max(8, min(70, min_len))
    max_len = max(min_len + 1, min(130, max_len))
    
    return min_len, max_len

def _safe_summarize(text: str) -> str:
    """Safely summarize with intelligent error recovery using direct model API."""
    try:
        text_words = len(text.split())
        
        if text_words < 15:
            return text
        
        min_len, max_len = _calculate_t5_lengths(text_words)
        
        print(f"[T5] Summarizing {text_words} words -> {min_len}-{max_len}")
        
        # Validation
        assert min_len < max_len, f"Invalid bounds: {min_len}-{max_len}"
        
        # Prepare input for T5
        input_prompt = f"summarize: {text}"
        inputs = tokenizer.encode(input_prompt, return_tensors="pt", max_length=512, truncation=True).to(device)
        
        # Generate summary using greedy decoding with temperature for speed and accuracy
        with torch.no_grad():
            summary_ids = model.generate(
                inputs,
                max_length=max_len,
                min_length=min_len,
                num_beams=1,  # Greedy decoding: 2-4x faster than beam search
                early_stopping=True,
                do_sample=True,  # Enable sampling for better diversity
                temperature=0.7,  # Controlled randomness maintains accuracy
                top_k=50,  # Reduce vocabulary for faster selection
                top_p=0.95  # Nucleus sampling for quality
            )
            # Clear GPU cache to prevent memory buildup
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        
        # Decode the summary
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        
        if not summary or summary.strip() == "":
            print(f"[T5] Empty result, returning truncated text")
            words = text.split()
            return " ".join(words[:max(15, len(words) // 3)])
        
        print(f"[T5] Result: {len(summary.split())} words")
        
        return summary
    
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

    start_time = time.time()
    text = text.strip()
    words = text.split()
    input_length = len(words)

    log_batch("INIT", {"words": input_length, "chars": len(text)})

    # Too short to summarize
    if input_length < T5_MIN_WORDS:
        log_batch("SKIP", {"reason": "text_too_short", "words": input_length, "min_required": T5_MIN_WORDS})
        return text

    # Single pass: text fits in one chunk
    if input_length <= T5_MAX_WORDS:
        log_batch("MODE", {"type": "single_pass", "words": input_length, "chunk_size": T5_MAX_WORDS})
        result = _safe_summarize(text)
        elapsed = time.time() - start_time
        output_words = len(result.split())
        log_batch("COMPLETE", {"input": input_length, "output": output_words, "reduction": f"{(1-output_words/input_length)*100:.1f}%", "time": f"{elapsed:.2f}s"})
        return result

    # Multi-pass: chunk, summarize each, then combine
    log_batch("MODE", {"type": "multi_pass", "chunk_size": T5_MAX_WORDS})
    chunks = _chunk_text(text, T5_MAX_WORDS)
    log_batch("CHUNKING", {"total_chunks": len(chunks), "chunk_size": T5_MAX_WORDS})
    
    chunk_summaries = []
    chunk_stats = []
    
    for i, chunk in enumerate(chunks):
        chunk_words = len(chunk.split())
        chunk_progress = f"{i+1}/{len(chunks)}"
        log_batch(f"BATCH_{chunk_progress}", {"chunk_words": chunk_words, "status": "processing"})
        
        # Skip tiny chunks
        if chunk_words < 20:
            log_batch(f"BATCH_{chunk_progress}", {"chunk_words": chunk_words, "status": "skipped_small"})
            chunk_summaries.append(chunk[:min(100, len(chunk))])
            chunk_stats.append({"chunk": i+1, "input": chunk_words, "output": len(chunk[:min(100, len(chunk))].split()), "type": "small_kept"})
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
    if combined_words <= T5_MAX_WORDS:
        log_batch("FINAL", {"status": "single_pass", "words": combined_words})
        final_summary = _safe_summarize(combined)
        final_words = len(final_summary.split())
        elapsed = time.time() - start_time
        overall_reduction = f"{(1 - final_words/input_length)*100:.1f}%"
        log_batch("COMPLETE", {"input": input_length, "output": final_words, "overall_reduction": overall_reduction, "time": f"{elapsed:.2f}s"})
        return final_summary
    else:
        log_batch("FINAL", {"status": "truncate", "reason": "combined_still_long", "words": combined_words})
        max_summary_words = 120
        words_list = combined.split()
        if len(words_list) > max_summary_words:
            truncated = " ".join(words_list[:max_summary_words]) + "..."
            elapsed = time.time() - start_time
            log_batch("COMPLETE", {"input": input_length, "output": len(truncated.split()), "time": f"{elapsed:.2f}s"})
            return truncated
        elapsed = time.time() - start_time
        log_batch("COMPLETE", {"input": input_length, "output": len(combined.split()), "time": f"{elapsed:.2f}s"})
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
