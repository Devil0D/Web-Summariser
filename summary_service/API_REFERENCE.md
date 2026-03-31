# 📋 API Reference Card

## Summary Service v2.2.0 - All Endpoints

### ✅ Health & Status

#### GET `/`
```
Response: { status: "ok", service: "Websears Summary Service v2.1" }
```

#### GET `/health`
```
Response: { status: "healthy" }
```

#### GET `/models`
```
Response: {
  models: [...],
  capabilities: {
    text_summarization: ["bart", "t5", "lexrank", "combined"],
    pdf_processing: ["combined", "bart", "t5", "lexrank"],
    image_analysis: ["image-to-text-vision-model"],
    formats_supported: {...}
  }
}
```

---

### 📄 Text & PDF Summarization

#### POST `/summarize`
**Original endpoint - Text or file upload**
```
Form Data:
  text?: string
  file?: UploadFile (pdf or txt)

Response: {
  bart_summary: string,
  t5_summary: string,
  extractive_summary: string,
  final_summary: string,
  raw_final_summary: string
}
```

#### POST `/upload/pdf` ⭐ NEW
**Upload PDF, extract text, summarize**
```
Form Data:
  file: UploadFile (.pdf)
  model: string? (combined|bart|t5|lexrank)

Response: {
  filename: string,
  summary: string,
  model_used: string,
  pdf_metadata: {
    pages: number,
    title: string,
    author: string,
    extraction_quality: string
  },
  extracted_text_preview: string,
  [bart_summary, t5_summary, extractive_summary if model="combined"]
}
```

#### POST `/summarize/selective`
**Choose specific model**
```
JSON Body: {
  text: string,
  model: string (combined|bart|t5|lexrank)
}

Response: {
  summary: string,
  model_used: string,
  [additional summaries if combined]
}
```

#### POST `/summarize/url`
**Summarize web content**
```
JSON Body: {
  text: string,
  url: string,
  title?: string,
  model?: string
}

Response: (same as selective)
```

---

### 🖼️ Image Analysis

#### POST `/upload/image` ⭐ NEW
**Upload image for AI analysis**
```
Form Data:
  file: UploadFile (jpg|png|gif|bmp|webp)

Response: {
  filename: string,
  short_summary: string,
  detailed_analysis: string,
  image_info: {
    size: [width, height],
    format: string,
    mode: string,
    model: "blip-image-captioning"
  },
  analysis_type: "image_to_text_vision_model"
}
```

#### POST `/upload/image/extract-text` ⭐ NEW
**Extract text content from image**
```
Form Data:
  file: UploadFile (jpg|png|gif|bmp|webp)

Response: {
  filename: string,
  type: "image_description",
  content: string,
  method: "vision_model",
  metadata: {...},
  note: string
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Error message describing what went wrong"
}
```
Examples:
- `"No file provided"`
- `"Only PDF files are supported"`
- `"Unsupported image format"`
- `"No text or file provided to summarize"`

### 500 Internal Server Error
```json
{
  "detail": "Error message describing server issue"
}
```
Examples:
- `"Failed to read PDF: ..."`
- `"Failed to analyze image: ..."`
- `"Failed to process the request: ..."`

---

## Quick Examples

### curl - PDF Summarization
```bash
curl -X POST http://localhost:5001/upload/pdf \
  -F "file=@document.pdf" \
  -F "model=combined"
```

### curl - Image Analysis
```bash
curl -X POST http://localhost:5001/upload/image \
  -F "file=@photo.jpg"
```

### Python - PDF
```python
import requests

with open("paper.pdf", "rb") as f:
    files = {"file": ("paper.pdf", f, "application/pdf")}
    data = {"model": "combined"}
    response = requests.post(
        "http://localhost:5001/upload/pdf",
        files=files,
        data=data
    )
    result = response.json()
    print(result["summary"])
```

### Python - Image
```python
import requests

with open("screenshot.png", "rb") as f:
    files = {"file": ("screenshot.png", f, "image/png")}
    response = requests.post(
        "http://localhost:5001/upload/image",
        files=files
    )
    result = response.json()
    print(result["short_summary"])
```

### JavaScript/Fetch
```javascript
// PDF Upload
const formData = new FormData();
formData.append("file", pdfFile);
formData.append("model", "combined");

fetch("http://localhost:5001/upload/pdf", {
  method: "POST",
  body: formData
})
.then(r => r.json())
.then(data => console.log(data.summary));

// Image Upload
const imgFormData = new FormData();
imgFormData.append("file", imageFile);

fetch("http://localhost:5001/upload/image", {
  method: "POST",
  body: imgFormData
})
.then(r => r.json())
.then(data => console.log(data.short_summary));
```

---

## Model Selection

| Model | Speed | Quality | Use Case |
|-------|-------|---------|----------|
| **BART** | ⚡⚡ | ★★★★ | Balanced, general purpose |
| **T5** | ⚡ | ★★★★★ | Best quality, slower |
| **LexRank** | ⚡⚡⚡ | ★★★ | Fast, extractive only |
| **Combined** | ⚡ | ★★★★★ | All 3 + merge, best quality |

---

## Supported File Types

### PDF
- ✓ `.pdf` (text-based)
- ✗ Scanned/image-only PDFs (no selectable text)
- Max: ~50MB, 50,000 characters extracted

### Images
- ✓ `.jpg` / `.jpeg`
- ✓ `.png`
- ✓ `.gif`
- ✓ `.bmp`
- ✓ `.webp`
- Max: ~25MB

---

## Response Times (Approximate)

| Operation | First | Cached |
|-----------|-------|--------|
| Text summary (all models) | 5-10s | 2-3s |
| PDF summary (10 pages) | 8-12s | 3-5s |
| Image analysis | 5-10s | 1-2s |
| Single model | 2-5s | 1s |

---

## Environment Setup

### Installation
```bash
cd summary_service
pip install -r requirements.txt
```

### Start Service
```bash
uvicorn main:app --reload --port 5001
```

### Access
- API: http://localhost:5001
- Docs: http://localhost:5001/docs (Swagger UI)
- ReDoc: http://localhost:5001/redoc

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: No module named 'pypdf'` | `pip install pypdf` |
| `ModuleNotFoundError: No module named 'transformers'` | `pip install transformers torch` |
| Image model won't load | First request downloads model (~355MB), be patient |
| PDF extraction returns empty | PDF is scanned/image-only, not text-based |
| Connection refused | Check API is running on port 5001 |

---

**Version**: 2.2.0  
**Last Updated**: 2024  
**Docs**: See `UPLOAD_FEATURES.md` for full documentation
