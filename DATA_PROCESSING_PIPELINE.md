# 📊 Data Processing & Summarization Pipeline

## System Overview

The Web-Summariser processes content through multiple stages:
1. **Data Capture** (links, files, PDFs)
2. **Text Extraction** (PDF parsing, content normalization)
3. **Summarization** (BART, T5, LexRank models)
4. **Output Formatting** (structured summary with metadata)

```
┌─────────────────────────────────────────────────────────────┐
│ INPUT SOURCES                                               │
│ • Web page URLs (content extraction)                        │
│ • PDF files (client/server extraction)                      │
│ • Direct text input (manual paste)                          │
│ • Image files (vision model analysis)                       │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ TEXT EXTRACTION & NORMALIZATION                             │
│ • Link: Browser DOM extraction                              │
│ • PDF Client: PDF.js (browser-based)                        │
│ • PDF Server: pypdf/pdfplumber (fallback)                   │
│ • Image: Vision model description                           │
│ • Clean: Remove whitespace, enforce limits                  │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ MODEL SELECTION                                             │
│ • Local: BART, T5, LexRank, Combined                        │
│ • Cloud: OpenAI, Gemini, Anthropic, etc.                    │
│ • Ollama: Local LLM (llama3.2, etc.)                        │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ SUMMARIZATION ENGINE                                        │
│ • Execute model(s) with timeout protection                  │
│ • Combine outputs (if multi-model)                          │
│ • Format structured output                                  │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ OUTPUT                                                      │
│ • Summary text (formatted with bullets)                     │
│ • Metadata (model used, processing time)                    │
│ • Source info (URL, file info, page count)                  │
│ • Download/Save options                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ Data Input & Capture

### A. Link Capturing (Web Pages)

**Flow:**
```
User browses webpage
    ↓
Extension content.js detects page load
    ↓
Extract page content (DOM traversal)
    ↓
Text extracted to extension sidebar
    ↓
Stored in state.pageText
    ↓
Ready for summarization
```

**Extraction Method:**
- The extension's `content.js` runs on every page
- Extracts main content using DOM queries
- Removes navigation, ads, scripts
- Captures: text content, page title, URL

**Location:** `extension/content.js`

**Data Structure:**
```javascript
state.pageText   // Full page content
state.pageTitle  // Page <title> or <h1>
state.pageUrl    // Current URL
state.selectedFile // For file uploads
```

---

### B. PDF Input Processing

#### **Client-Side (Offline) - PDF.js**

**With Internet (CDN loaded):**
```
User uploads PDF
    ↓
readFileAsText() checks file type
    ↓
IS PDF? → Try load PDF.js from CDN
    ↓
CDN responsive? → Extract using PDF.js in browser
    ↓
Parse PDF pages sequentially
    ↓
Extract text from each page
    ↓
Join pages with newlines
    ↓
Return full extracted text
```

**Process:**
1. Load PDF.js library from CDN: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js`
2. Convert PDF file to ArrayBuffer
3. Parse with `pdfjsLib.getDocument({data: arrayBuffer})`
4. Iterate through pages: Extract text content
5. Combine all page texts

**Code Location:** `extension/sidebar.js` → `extractPdfClientSide()`

**Advantages:**
- Works offline (after PDF.js loads)
- Instant extraction (no server needed)
- Better than server for low-latency

**Disadvantages:**
- Requires internet to load (first time)
- Can fail with scanned/image-only PDFs

---

#### **Offline Fallback - Server-Side Extraction**

**When CDN fails (No internet / Ollama mode):**
```
User tries PDF but no internet
    ↓
PDF.js CDN fails to load
    ↓
Catch error → Try server-side extraction
    ↓
Send PDF file to /upload/pdf endpoint
    ↓
Server processes using pypdf/pdfplumber
    ↓
Server returns extracted text
    ↓
Use returned text for summarization
```

**Process (Server):**
1. Receive PDF bytes at `POST /upload/pdf`
2. Try pdfplumber first (better quality)
3. Fallback to pypdf if pdfplumber fails
4. Extract text page-by-page
5. Clean and normalize extracted text
6. Return: `{text, metadata}`

**Code Location:** `summary_service/pdf_handler.py`

**Key Features:**
- **Dual extraction**: pdfplumber → pypdf fallback
- **Error handling**: Returns helpful error if no text found
- **Metadata**: Pages extracted, extraction method, quality score
- **Character limits**: Max 50,000 chars

**Advantages:**
- Works offline (no CDN needed)
- Better at handling corrupted PDFs
- Can use pypdf library from server

**Disadvantages:**
- Requires server to be running
- Adds network latency (5-10ms)
- Server must have PDF libraries installed

---

**Automatic Fallback Chain:**
```
readFileAsText(pdf_file)
    ↓
IF window.pdfjsLib exists
    ↓ YES → Try client extraction
    ↓ SUCCESS → Return text
    ↓ FAILED → Continue
    ↓
Try load PDF.js from CDN
    ↓ SUCCESS → Extract client-side
    ↓ FAILED →  Try server-side (final fallback)
    ↓
POST /upload/pdf to server
    ↓ SUCCESS → Return server-extracted text
    ↓ FAILED → ERROR (both failed)
```

---

### C. Direct Text Input

**User manually pastes text:**
```
User types/pastes into textarea
    ↓
Text stored in state.pageText
    ↓
Send to models directly
    ↓
No extraction needed
```

---

### D. Image Input

**Vision Model Analysis:**
```
User uploads image
    ↓
Server receives at /upload/image
    ↓
Load & validate with PIL (Pillow)
    ↓
Run BLIP vision model
    ↓
Model generates description
    ↓
Return: short_summary + detailed_analysis
```

---

## 2️⃣ Text Normalization & Processing

### Text Cleaning Pipeline

```
Raw extracted text
    ↓
1. Remove excessive whitespace
   - Replace multiple newlines with double newlines
   - Normalize spaces and tabs
   ↓
2. Enforce character limits
   - Max 50,000 characters (default)
   - Warn if truncated
   ↓
3. Remove special characters
   - Keep: alphanumeric, punctuation, newlines
   - Remove: binary, control characters
   ↓
4. Normalize sentence breaks
   - Split on: . ! ?
   ↓
Cleaned text ready for models
```

**Code Location:** `summary_service/pdf_handler.py` → `clean_extracted_text()`

**Key Functions:**
```python
def clean_extracted_text(text, max_chars=50000):
    # Normalize whitespace
    cleaned = re.sub(r"\n\s*\n", "\n\n", text)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = cleaned.strip()
    
    # Truncate if needed
    if len(cleaned) > max_chars:
        logger.warning(f"Text truncated from {len(cleaned)} to {max_chars}")
        cleaned = cleaned[:max_chars]
    
    return cleaned
```

---

## 3️⃣ Summarization Engine

### Model Selection

**Local Models (FastAPI server on port 5001):**

| Model | Type | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **BART** | Abstractive | ⚡⚡ | ★★★★ | General, balanced |
| **T5** | Abstractive | ⚡ | ★★★★★ | High quality, slow |
| **LexRank** | Extractive | ⚡⚡⚡ | ★★★ | Fast, bullet points |
| **Combined** | Multi | ⚡ | ★★★★★ | All 3 + merge, best |

**Cloud Models (External APIs):**
- OpenAI (GPT-4, GPT-3.5)
- Google Gemini
- Anthropic Claude
- Mistral
- Groq
- Cohere

**Offline Local (Ollama):**
- llama3.2 (requires: `ollama serve` + `ollama pull llama3.2`)

---

### Summarization Flow

#### **Local Model (BART/T5/LexRank):**

```
1. TEXT SENT TO SERVER
   POST /summarize/selective
   {
     "text": "extracted content...",
     "model": "bart|t5|lexrank|combined"
   }

2. SERVER PROCESSING
   ├─ Load model from cache or memory
   ├─ Process text through model
   ├─ Run inference
   └─ Format output

3. MODEL INFERENCE
   ├─ Tokenize text
   ├─ Generate summary tokens
   └─ Decode to text

4. FORMATTING
   ├─ Normalize summary
   ├─ Extract key points
   ├─ Create bullet structure
   └─ Format as: "Summary Overview: ... \n\nKey Points:\n - ..."

5. RETURN RESPONSE
   {
     "summary": "formatted summary...",
     "model_used": "bart",
     "raw_final_summary": "raw text..."
   }

6. EXTENSION DISPLAYS
   Show summary in message thread
   Add to history
   Download option available
```

**Code Location:** 
- Server: `summary_service/main.py` → `/summarize/selective` endpoint
- Models: `summary_service/bart.py`, `T5.py`, `extractive_summary.py`

---

#### **Combined Model (All 3):**

```
1. SEND TEXT TO SERVER
   POST /summarize
   (no model specified = combined)

2. SERVER PARALLEL PROCESSING
   ├─ BART model: Generate summary
   ├─ T5 model: Generate summary  
   └─ LexRank model: Generate summary

3. MERGE SUMMARIES
   ├─ Combine all 3 outputs
   ├─ De-duplicate sentences
   ├─ Merge key points
   └─ Create final summary

4. SECOND PASS
   ├─ Run LexRank on merged summary
   ├─ Extract most important points
   └─ Format final output

5. RETURN ALL RESULTS
   {
     "bart_summary": "...",
     "t5_summary": "...",
     "extractive_summary": "...",
     "final_summary": "formatted combined...",
     "raw_final_summary": "..."
   }

6. DISPLAY
   Show final_summary in conversation
   Show individual summaries in breakdown
```

**Code Location:** `summary_service/main.py` → `_build_combined()`

---

### Timeout Protection (NEW)

**Problem:** BART and T5 can hang on long inputs

**Solution:** Automatic timeout with helpful error messages

```javascript
// Before: No timeout → could hang indefinitely
await fetch('/summarize/selective', {body: JSON.stringify({text, model})});

// After: 2-minute timeout with AbortController
const TIMEOUT_MS = 120000; // 2 minutes
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

await fetch('/summarize/selective', {
  body: JSON.stringify({text, model}),
  signal: controller.signal  // Abort if timeout
});
```

**Error Messages Shown:**
- "Summarization timeout (120s). Text may be too long. Try shorter text or single model instead of combined."
- Suggests using BART instead of T5 if T5 times out
- Suggests single model mode if combined times out

---

### Error Handling

**Common Error Chain:**

```
Error at each stage:
    ↓
1. EXTRACTION ERROR
   "Could not read PDF file"
   "No text found in PDF"
   ↓ SHOW: Helpful error message
   ↓ TRY: Alternative extraction method

2. TIMEOUT ERROR
   "Summarization timeout (120s)"
   ↓ SHOW: "Text too long or model slow"
   ↓ TRY: Shorter text or faster model

3. MODEL ERROR
   "Model error (500): Server returned error"
   ↓ SHOW: Error message
   ↓ TRY: Different model

4. SERVER ERROR
   "Local server offline"
   ↓ SHOW: "Restart server"
   ↓ TRY: Start: uvicorn main:app --port 5001

5. API ERROR
   "Invalid API key for OpenAI"
   ↓ SHOW: Check settings
   ↓ TRY: Re-enter API key
```

---

## 4️⃣ Output & Formatting

### Summary Structure

**Example Output:**
```
Summary Overview:
The document discusses the perceptron, which is a single processing unit in neural 
networks used for linear classification in supervised learning.

Key Points:
- The perceptron uses an input layer of artificial neurons
- It calculates weighted sum and adds bias to the result
- Primarily used for binary and multi-class classification
- Activation function determines output based on threshold
- Foundation for deeper neural network architectures
```

**Formatting Code:**
```python
def _format_summary(raw_summary: str) -> str:
    # 1. Normalize text
    clean_summary = _normalize_text(raw_summary)
    
    # 2. Extract key points (max 6)
    bullets = _dedupe_sentences(clean_summary, limit=6)
    
    # 3. Split: overview + key points
    overview = bullets[0] if bullets else "No summary"
    key_points = bullets[1:] if len(bullets) > 1 else bullets
    
    # 4. Format
    lines = [
        "Summary Overview:",
        overview,
        "",
        "Key Points:",
    ]
    
    for item in key_points[:5]:
        lines.append(f"- {item}")
    
    return "\n".join(lines).strip()
```

---

### Metadata Included

**For web pages:**
- URL
- Title
- Summary generated timestamp
- Model used
- Processing time

**For PDFs:**
- Filename
- Pages extracted
- Extraction method (pypdf/pdfplumber)
- Text preview (first 200 chars)

**For images:**
- Image dimensions
- Format (JPEG, PNG, etc.)
- Analysis type (vision model)

---

## 5️⃣ Data Flow Examples

### Example 1: Summarize Web Page

```
1. USER
   Visits webpage, clicks "Summarize" in extension

2. EXTENSION (sidebar.js)
   → extractPageContent()
   → Store in state.pageText
   → Show "Processing..." spinner

3. EXTENSION SELECTS MODEL
   Local server online? → Use BART (fast)
   → callLocalModel(text, "bart")

4. SERVER (FastAPI)
   POST /summarize/selective
   ├─ Load BART from memory
   ├─ Run inference: text → summary
   ├─ Format output
   └─ Return: {summary, model_used}

5. EXTENSION
   Receive JSON response
   → Display summary in sidebar
   → Save to history (chrome.storage)
   → Enable download button

6. USER
   Reads summary
   Can: Download, Copy, Share, Save to history
```

---

### Example 2: Upload & Summarize PDF

```
1. USER
   Clicks "Upload File" in extension
   → Selects PDF from computer

2. EXTENSION (sidebar.js)
   readFileAsText(pdf_file)
   
   TRY: Extract with PDF.js (client-side)
        No internet? → PDFjs CDN fails
        
   FALLBACK: POST/upload/pdf to server
             (server uses pypdf/pdfplumber)

3. SERVER (pdf_handler.py)
   ├─ Receive PDF bytes
   ├─ Try pdfplumber extraction
   ├─ If fails: Try pypdf extraction
   ├─ Clean & normalize text
   └─ Return: {text, metadata}

4. TEXT TO SUMMARIZATION
   Server receives cleaned text
   → Compute summary with model
   → Format output
   → Return to extension

5. EXTENSION
   Display summary with metadata:
   - "PDF: document.pdf (15 pages)"
   - "Model: BART"
   - Summary text
```

---

### Example 3: Multi-Model Analysis (Combined)

```
1. USER selects "Combined" model

2. EXTENSION → SERVER
   POST /summarize
   {text, model: "combined"}
   + Timeout: 120 seconds

3. SERVER PROCESSES (main.py)
   A) BART Summary
      ├─ Load BART model
      ├─ Run inference
      └─ Extract key points
      
   B) T5 Summary
      ├─ Load T5 model
      ├─ Run inference (slow ~30s)
      └─ Extract key points
      
   C) LexRank Summary
      ├─ Run quick extraction
      └─ Extract key points

4. MERGE RESULTS
   ├─ Combine all 3 summaries
   ├─ De-duplicate sentences
   ├─ Run LexRank on merged text
   └─ Format final output

5. RETURN
   {
     "bart_summary": "...",
     "t5_summary": "...",
     "extractive_summary": "...",
     "final_summary": "===BEST===",
     "raw_final_summary": "..."
   }

6. DISPLAY
   Show combined summary as main
   Show individual summaries in expandable sections
```

---

## 6️⃣ Performance Characteristics

### Processing Times

| Task | First | Cached | Notes |
|------|-------|--------|-------|
| Web page extraction | <1s | <1s | DOM parsing |
| PDF (10 pages) | 1-2s | 1-2s | File reading + parsing |
| BART summary | 3-5s | 2-4s | Model in memory |
| T5 summary | 8-15s | 5-10s | Slower model |
| LexRank summary | 1-2s | 1-2s | Fast extractive |
| Combined (all 3) | 15-25s | 10-20s | Parallel + merge |
| Vision image analysis | 5-10s (1st) | 1-2s | Model downloads ~355MB |

### Memory Usage

| Component | RAM |
|-----------|-----|
| BART model | ~500 MB |
| T5 model | ~800 MB |
| LexRank | ~50 MB |
| BLIP vision model | ~600 MB |
| All text models | ~2.5 GB |
| Browser extension | ~20-50 MB |

---

## 7️⃣ Troubleshooting

### "Could not load PDF.js" with Ollama

**Problem:** PDF.js tries to load from CDN but no internet when using Ollama

**Solution:** 
1. Auto-fallback to server extraction (NEW)
2. Server uses pypdf/pdfplumber locally
3. Works without internet if server running

**Check:**
```bash
# Verify server running
curl http://localhost:5001/health

# Upload PDF works
curl -X POST http://localhost:5001/upload/pdf \
  -F "file=@test.pdf" \
  -F "model=combined"
```

---

### "Summarization timeout" with T5

**Problem:** T5 is slow, times out on long text

**Solution:**
1. Use BART instead (faster)
2. Use shorter input text
3. Increase timeout if needed (edit `extension/sidebar.js` line 377: `TIMEOUT_MS = 240000`)

---

### "index out of range in self perceptron"

**Problem:** Model error during summarization

**Solution:**
1. Try different model (BART → T5 → LexRank)
2. Shorten input text
3. Make sure models installed: `pip install -r requirements.txt`

---

## Architecture Summary

```
WEB EXTENSION          SUMMARY SERVICE         MODELS
─────────────          ─────────────           ──────
sidebar.js             main.py
  ├─ UI                  ├─ /summarize
  ├─ PDF parsing         │  └─ _build_combined()
  └─ Data capture        ├─ /summarize/selective
                         ├─ /upload/pdf
                         │  └─ pdf_handler.py
                         ├─ /upload/image
                         │  └─ image_analyzer.py
                         └─ Error handling
                         
                                    ├─ BART
                                    ├─ T5
                                    └─ LexRank
```

---

**Version:** 2.2.0  
**Updated:** With timeout protection & improved PDF fallback  
**Status:** Production ready
