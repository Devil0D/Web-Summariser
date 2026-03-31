# Upload Features - PDF & Image Processing

## Overview
The summary service now supports direct PDF and image uploads with intelligent processing and analysis. Files are preprocessed to extract content, then sent to your ML models for summarization or analysis.

---

## Features

### 1. **PDF Upload & Summarization** 📄
**Endpoint:** `POST /upload/pdf`

Upload PDF files and get automatic text extraction + summarization.

**Request:**
```
POST /upload/pdf HTTP/1.1
Content-Type: multipart/form-data

file: <PDF_FILE>
model: combined  # optional: combined, bart, t5, lexrank
```

**Response:**
```json
{
  "filename": "document.pdf",
  "summary": "Summary Overview:\n...",
  "raw_summary": "...",
  "model_used": "combined",
  "pdf_metadata": {
    "pages": 10,
    "title": "Document Title",
    "author": "Author Name",
    "created": "2024-01-15",
    "extraction_method": "pypdf",
    "has_text": true,
    "extraction_quality": "good"
  },
  "extracted_text_preview": "First 200 chars of extracted text...",
  "bart_summary": "...",
  "t5_summary": "...",
  "extractive_summary": "..."
}
```

**Features:**
- ✓ Automatic text extraction using pypdf & pdfplumber
- ✓ Fallback extraction methods for better coverage
- ✓ PDF metadata retrieval (pages, title, author, date)
- ✓ Text cleaning and normalization
- ✓ Support for all summarization models (BART, T5, LexRank, Combined)
- ✓ Character limit handling (50,000 chars max)
- ✓ Detailed error reporting for corrupted/image-only PDFs

**Usage Examples:**

```python
# Using curl
curl -X POST http://localhost:5001/upload/pdf \
  -F "file=@document.pdf" \
  -F "model=combined"

# Using Python requests
import requests

with open("document.pdf", "rb") as f:
    files = {"file": ("document.pdf", f, "application/pdf")}
    data = {"model": "combined"}
    response = requests.post("http://localhost:5001/upload/pdf", 
                           files=files, data=data)
    result = response.json()
    print(result["summary"])
```

---

### 2. **Image Upload & Analysis** 🖼️
**Endpoint:** `POST /upload/image`

Upload images for AI-powered content analysis.

**Request:**
```
POST /upload/image HTTP/1.1
Content-Type: multipart/form-data

file: <IMAGE_FILE>  # JPEG, PNG, GIF, BMP, WebP
```

**Response:**
```json
{
  "filename": "screenshot.png",
  "short_summary": "A detailed description of the image content...",
  "detailed_analysis": "Image Analysis Summary:\n\nContent Description:\nA detailed description...\n\nImage Details: 1920x1080px, PNG",
  "image_info": {
    "size": [1920, 1080],
    "format": "PNG",
    "mode": "RGBA",
    "model": "blip-image-captioning",
    "analysis_type": "image_to_text"
  },
  "analysis_type": "image_to_text_vision_model"
}
```

**Features:**
- ✓ Lightweight vision model (BLIP) for image description
- ✓ Image format validation (JPEG, PNG, GIF, BMP, WebP)
- ✓ Automatic image loading and error handling
- ✓ Image metadata extraction (size, format, color mode)
- ✓ Model caching for faster subsequent requests
- ✓ CPU-optimized inference (no GPU required)

**Usage Examples:**

```python
# Using curl
curl -X POST http://localhost:5001/upload/image \
  -F "file=@screenshot.png"

# Using Python
import requests

with open("image.jpg", "rb") as f:
    files = {"file": ("image.jpg", f, "image/jpeg")}
    response = requests.post("http://localhost:5001/upload/image", 
                           files=files)
    result = response.json()
    print(result["short_summary"])
```

---

### 3. **Image Text Extraction** 📸
**Endpoint:** `POST /upload/image/extract-text`

Extract text content from images using vision models.

**Request:**
```
POST /upload/image/extract-text HTTP/1.1
Content-Type: multipart/form-data

file: <IMAGE_FILE>
```

**Response:**
```json
{
  "filename": "screenshot.png",
  "type": "image_description",
  "content": "Text description of the image content...",
  "method": "vision_model",
  "metadata": {
    "size": [1920, 1080],
    "format": "PNG",
    "model": "blip-image-captioning"
  },
  "note": "For precise OCR text extraction, install pytesseract and Tesseract-OCR"
}
```

**Features:**
- ✓ Vision model-based text extraction
- ✓ Works well for screenshots, documents, signs
- ✓ Optional: Can be upgraded with pytesseract + Tesseract-OCR for precise OCR

**Advanced: Using pytesseract for True OCR**

For production OCR needs, install Tesseract:

```bash
# Windows (using Chocolatey)
choco install tesseract

# Or download from: https://github.com/UB-Mannheim/tesseract/wiki

# Then install pytesseract
pip install pytesseract
```

Then modify `image_analyzer.py` to use pytesseract:

```python
import pytesseract

def extract_text_ocr(image_data: bytes):
    img = load_image(image_data)
    text = pytesseract.image_to_string(img)
    return text
```

---

## Model Architecture

### Modular Design

```
summary_service/
├── main.py                    # FastAPI app + routes
├── pdf_handler.py             # PDF extraction logic
├── image_analyzer.py          # Image analysis logic
├── bart.py                    # BART summarization
├── T5.py                      # T5 summarization
├── extractive_summary.py      # LexRank summarization
└── test_upload_endpoints.py   # Test suite
```

### PDF Handler (`pdf_handler.py`)

**Functions:**
- `extract_pdf_text(pdf_data, use_pdfplumber=False)` - Main extraction
  - Returns: (text, metadata)
  - Fallback: pypdf if pdfplumber fails
  - Handles corrupted/image-only PDFs gracefully

- `clean_extracted_text(text, max_chars=50000)` - Cleaning & normalization
  - Removes excessive whitespace
  - Enforces char limits
  - Preserves structure

- `get_pdf_metadata(pdf_data)` - Metadata extraction
  - Page count, title, author, creation date

### Image Analyzer (`image_analyzer.py`)

**Functions:**
- `load_image(image_data)` - Validation & loading
  - PIL Image validation
  - Size checks
  - Format verification

- `analyze_image_content(image_data)` - Vision model inference
  - Returns: (description, metadata)
  - Model: BLIP image captioning
  - Cached inference

- `generate_image_summary(image_data)` - Structured output
  - Short summary
  - Detailed analysis
  - Image metadata

- `extract_image_text(image_data)` - Text extraction
  - Vision model description of text
  - Can be upgraded to pytesseract for true OCR

- `validate_image_file(filename, content_type)` - Format validation

---

## Dependencies

### New Dependencies Added
```
pypdf>=3.0.0              # PDF reading (fallback)
pillow>=11.0.0            # Image processing
pdfplumber==0.11.0        # PDF extraction (preferred)
transformers>=4.40.0      # Vision models (already present)
torch>=2.0.0              # Model inference (already present)
```

### Download Sizes
- **BLIP model** (~355 MB) - Downloaded on first use
- Models are cached after first load
- CPU-optimized inference

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Health check |
| `/health` | GET | API health status |
| `/models` | GET | List available models & capabilities |
| `/upload/pdf` | POST | Upload PDF and summarize |
| `/upload/image` | POST | Upload image and analyze |
| `/upload/image/extract-text` | POST | Extract text from image |
| `/summarize` | POST | Original: text or file summarization |
| `/summarize/selective` | POST | Choose specific model |
| `/summarize/url` | POST | Summarize extracted web content |

---

## Error Handling

### Common Errors

**PDF Issues:**
- ❌ `400: Only PDF files are supported`
  - Solution: Ensure file extension is .pdf

- ❌ `400: PDF appears to be image-only`
  - Solution: PDF contains scanned images, not selectable text
  - Use OCR tools outside this service

- ❌ `500: Failed to read PDF`
  - Solution: PDF may be corrupted. Try with different PDF.

**Image Issues:**
- ❌ `400: Unsupported image format`
  - Supported: JPEG, PNG, GIF, BMP, WebP
  - Solution: Convert image to supported format

- ❌ `400: Image file is empty`
  - Solution: Upload a valid image file

- ❌ `500: transformers library not available`
  - Solution: `pip install transformers torch`

---

## Performance Notes

### Typical Response Times
- **PDF (10 pages, 5KB text)**: ~2-5 seconds (with all 3 models)
- **Image (1080p JPG)**: ~3-8 seconds (first load), ~1-2 seconds (cached model)

### Memory Usage
- **BLIP model**: ~600 MB RAM
- **All 3 text models**: ~2-3 GB RAM combined
- **Total service**: ~3-4 GB

### Optimization Tips
- ✓ Reuse `/upload/pdf` for batch processing (models stay loaded)
- ✓ Use single model mode (`?model=bart`) to reduce latency
- ✓ Process smaller PDFs first (~20 pages max)
- ✓ Image analysis is lightweight - prioritize this for real-time use

---

## Testing

### Run Tests
```bash
cd summary_service

# Start API (in one terminal)
uvicorn main:app --reload --port 5001

# Run tests (in another terminal)
python test_upload_endpoints.py
```

### Manual Testing with curl

```bash
# Test health
curl http://localhost:5001/health

# Upload PDF
curl -X POST http://localhost:5001/upload/pdf \
  -F "file=@sample.pdf" \
  -F "model=combined"

# Upload image
curl -X POST http://localhost:5001/upload/image \
  -F "file=@sample.jpg"
```

---

## Integration with Client

### React/Frontend Example
```typescript
// Upload PDF
const uploadPDF = async (file: File, model: string = "combined") => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", model);
  
  const response = await fetch("http://localhost:5001/upload/pdf", {
    method: "POST",
    body: formData,
  });
  
  return response.json();
};

// Upload image
const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch("http://localhost:5001/upload/image", {
    method: "POST",
    body: formData,
  });
  
  return response.json();
};
```

---

## Future Enhancements

- [ ] Support for `.docx`, `.xlsx`, `.pptx` files
- [ ] OCR integration with pytesseract for better text extraction
- [ ] Batch processing endpoint
- [ ] Support for image-to-image search
- [ ] Advanced image classification
- [ ] Document layout parsing
- [ ] Handwriting recognition

---

## Troubleshooting

**Q: Image analysis is slow on first request**
- A: Model is downloading (~355 MB). Subsequent requests are cached.

**Q: PDF extraction returns empty text**
- A: PDF is likely scanned/image-only. No selectable text to extract.

**Q: Getting CUDA out of memory errors**
- A: Running on CPU by default (`device=-1`). Check your system RAM.

**Q: Models not loading**
- A: Run `pip install -r requirements.txt` to ensure all dependencies installed.

---

## Files Modified

1. **main.py** - Added 3 new endpoints
2. **pdf_handler.py** - New file (PDF processing)
3. **image_analyzer.py** - New file (Image processing)
4. **test_upload_endpoints.py** - New file (Test suite)
5. **requirements.txt** - Added pypdf & pillow

---

**Created:** 2024
**Version:** 2.2.0 (with Upload Features)
