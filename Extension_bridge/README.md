# Summarizer API Bridge

Wraps your local **BART**, **T5**, and **LexRank** models as a FastAPI HTTP server so your Chrome extension (and existing Flask site) can call them without any API keys.

---

## Folder structure

```
summarizer-api/
├── api.py            ← the FastAPI server  (edit this)
├── requirements.txt
├── test_api.py       ← smoke-tests
└── README.md
```

---

## 1 — Install dependencies

```bash
# from inside this folder
pip install -r requirements.txt
```

First time only — download NLTK data used by LexRank / sumy:

```python
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab')"
```

---

## 2 — Start the server

```bash
uvicorn api:app --reload --port 8000
```

You'll see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

> Models load **lazily** — BART/T5 download on first request (~1-2 GB each).  
> Subsequent requests use cached weights and are much faster.

---

## 3 — Test it

```bash
python test_api.py
```

Or open **http://localhost:8000/docs** in your browser for the auto-generated Swagger UI.

---

## 4 — API reference

### `GET /health`
Returns `{"status": "healthy"}` — used by the extension to check if the server is running.

### `GET /models`
Returns the list of available local models — the extension calls this to populate the model dropdown.

### `POST /summarize`

```json
{
  "text":          "Your long article text here…",
  "model":         "bart",
  "max_length":    150,
  "min_length":    40,
  "num_sentences": 5
}
```

| Field | Options | Default |
|---|---|---|
| `model` | `bart` · `t5` · `lexrank` · `combined` | `bart` |
| `max_length` | any int | `150` |
| `min_length` | any int | `40` |
| `num_sentences` | any int (lexrank only) | `5` |

**Response:**

```json
{
  "summary":        "Summarized text…",
  "model_used":     "bart",
  "char_count_in":  1200,
  "char_count_out": 312
}
```

### `POST /summarize/file`

Upload a `.txt` or `.pdf` file as `multipart/form-data`.

```
file=<binary>   (required)
model=bart      (query param, optional)
max_length=150  (query param, optional)
min_length=40   (query param, optional)
```

---

## 5 — Connecting your Flask site

In your Flask app, replace direct model calls with:

```python
import requests

def summarize_via_api(text, model="bart"):
    resp = requests.post(
        "http://localhost:8000/summarize",
        json={"text": text, "model": model}
    )
    resp.raise_for_status()
    return resp.json()["summary"]
```

This keeps model loading out of your Flask process and avoids memory issues.

---

## 6 — Connecting the Chrome extension

The extension calls `http://localhost:8000/summarize` directly from the background service worker.  
No API key needed — it's your machine.

**Important:** the extension needs `"http://localhost:8000/*"` in its `permissions` list inside `manifest.json`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `CORS error` in browser | Server already has `allow_origins=["*"]`; check the port matches |
| Model download hangs | Check disk space; BART needs ~1.6 GB, T5 ~240 MB |
| `sumy` import error | `pip install sumy` then `nltk.download('punkt')` |
| `pdfplumber` import error | `pip install pdfplumber` |
| GPU not used | Set `device=0` in `get_bart()` / `get_t5()` and ensure CUDA is installed |
