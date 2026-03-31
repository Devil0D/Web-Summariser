# Quick Start: File Upload System

## 🚀 One-Minute Setup

### 1. Install Backend Dependencies
```bash
cd summary_service
pip install python-docx pytesseract
# Or update all: pip install -r requirements.txt
```

### 2. (Optional) Install Tesseract-OCR
For better image text extraction:

**Windows (PowerShell):**
```powershell
choco install tesseract
```

**macOS:**
```bash
brew install tesseract
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr
```

### 3. Restart Backend
```bash
uvicorn main:app --reload --port 5001
```

### 4. Test
Upload any of these file types in extension:
- 📄 PDF, DOCX, TXT
- 🖼️ JPG, PNG, GIF, BMP, WebP

---

## 📋 Supported File Types

| Type | Extension | Backend Info |
|------|-----------|--------------|
| Document | .pdf | PDF text extraction |
| Document | .docx | Python-docx parsing |
| Document | .txt | Direct text reading |
| Image | .jpg, .jpeg | Tesseract OCR |
| Image | .png | Tesseract OCR |
| Image | .gif | Tesseract OCR |
| Image | .bmp | Tesseract OCR |
| Image | .webp | Tesseract OCR |

---

## 🔧 Backend Functions (Quick Reference)

### `_extract_file_text(filename, content_type, data) → str`
**Universal router** - detects format and routes to appropriate extractor
- Returns: extracted text string
- Raises: HTTPException (400) with detailed error message

### `_extract_pdf_text(data) → str`
Extracts text from PDF bytes using pypdf

### `_extract_txt_text(data) → str`
Decodes TXT as UTF-8 string

### `_extract_docx_text(data) → str` ✨ NEW
Extracts text from DOCX:
- Paragraphs
- Table cells
- Empty structure detection

### `_extract_image_text(data) → str` ✨ NEW
OCR text extraction from images using pytesseract
- Requires system Tesseract-OCR (optional)
- Falls back gracefully if not installed
- Returns special message if no text found

---

## 🎯 Error Messages Implementation

Backend returns meaningful errors:

```python
raise HTTPException(400, 
    "Unsupported file type: file.xyz\n"
    "Supported formats: PDF, TXT, DOCX, JPG, PNG, GIF, BMP, WebP\n"
    "\nPlease upload a file in one of the supported formats."
)
```

Frontend receives these and displays in error box.

---

## 🧪 Quick Test Commands

### Test with DOCX
```bash
curl -X POST http://localhost:5001/summarize \
  -F "file=@document.docx"
```

### Test with Image
```bash
curl -X POST http://localhost:5001/summarize \
  -F "file=@screenshot.jpg"
```

### Test with Text
```bash
curl -X POST http://localhost:5001/summarize \
  -F "text=This is my text to summarize"
```

---

## ⚙️ State Management (Frontend)

New state property:
```javascript
state.fileSourceType = "image"  // "file", "image", etc
```

Used for:
- History categorization
- File type tracking
- Reset after each upload

---

## 📊 History Tracking

Each uploaded file now includes:
```json
{
  "title": "document.docx",
  "url": "",
  "model": "combined",
  "summary": "...",
  "sourceType": "file",  // NEW: identifies origin
  "date": "2026-03-31T..."
}
```

Filtered by tabs:
- All, Link, File, Text, (Image)

---

## ❓ Troubleshooting

### Import Error: "No module named 'docx'"
```bash
pip install python-docx
```

### Import Error: "No module named 'pytesseract'"
```bash
pip install pytesseract
```
Also need system Tesseract-OCR

### OCR Returns Empty String
```bash
# Check if Tesseract installed
tesseract --version
```

### Backend Error: "PDF appears to be scanned"
- The PDF has no extractable text
- Entire document is images
- No OCR in backend for PDFs

---

## 🔗 Integration Points

### Frontend → Backend
- Upload endpoint: `POST /summarize`
- Send: multipart form with `file` + optional `model` and `text`
- Receive: JSON with `final_summary`, `bart_summary`, etc.

### Error Flow
1. Frontend validation (regex)
2. Backend receives file
3. `_extract_file_text()` determines format
4. Format-specific extractor called
5. Error or text returned
6. Summarization or error display

---

## 📝 Code Examples

### Add New Format Support

To add support for a new format:

1. Create extraction function:
```python
def _extract_new_format(data: bytes) -> str:
    try:
        # Parse format
        extracted_text = parse_data(data)
        if not extracted_text.strip():
            raise HTTPException(400, "No text found in new format")
        return extracted_text
    except Exception as e:
        raise HTTPException(500, f"Failed to read file: {e}")
```

2. Add to router:
```python
def _extract_file_text(filename, content_type, data):
    # ... existing code ...
    
    if fn.endswith(".newext") or "newtype" in ct:
        return _extract_new_format(data)  # ADD THIS
```

3. Update regex in frontend:
```javascript
const supportedTypes = /\.(txt|pdf|docx|jpg|jpeg|png|gif|bmp|webp|newext)$/i;
```

---

## 🎓 Architecture

```
User uploads file
    ↓
Frontend setFile() validates extension
    ↓
Send to backend /summarize
    ↓
Backend receives multipart file
    ↓
_extract_file_text() router
    ├─ Checks extension
    ├─ Checks MIME type
    └─ Routes to specific extractor
        ├─ _extract_pdf_text()
        ├─ _extract_txt_text()
        ├─ _extract_docx_text() ← NEW
        └─ _extract_image_text() ← NEW
    ↓
Extract text
    ↓
Summarize
    ↓
Return results
```

---

## 📚 File References

- Backend: `summary_service/main.py` (lines ~20-220)
- Frontend: `extension/sidebar.js` (lines ~959-1150)
- UI: `extension/sidebar.html` (line ~1058-1065)
- Config: `requirements.txt` (lines ~13-15)

---

## ✅ Verification

Run this to verify backend support:
```python
# In Python shell
from docx import Document
import pytesseract
print("✓ DOCX support ready")
print("✓ OCR support ready")
```

---

**Status:** ✅ Fully Implemented and Tested  
**Date:** March 31, 2026

