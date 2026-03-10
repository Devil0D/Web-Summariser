# Websears Extension  +  FastAPI Bridge

This folder contains two things:

```
websears-extension/
├── summary_service/          ← Drop-in FastAPI replacement for your Flask main.py
│   ├── main.py               ← NEW — replace your existing main.py with this
│   └── requirements.txt      ← Updated deps
│
└── extension/                ← Chrome extension (load unpacked)
    ├── manifest.json
    ├── background.js
    ├── content.js
    ├── sidebar.html
    ├── sidebar.js
    └── icons/
```

---

## Part 1 — Upgrade the Summary Service (FastAPI)

### Why replace Flask with FastAPI?
- Same port (5001), same `/summarize` endpoint → **your Express server needs zero changes**
- Adds `/summarize/selective`, `/summarize/url`, `/models`, `/health` for the extension
- Proper CORS handling for browser extension requests
- Auto-generated docs at `http://localhost:5001/docs`

### Steps

**1. Copy the new files into your project**
```
summary_service/main.py          ← replaces your old main.py
summary_service/requirements.txt ← replaces your old one
```
Keep `bart.py`, `T5.py`, `extractive_summary.py` exactly as they are — nothing changes there.

**2. Install new deps**
```bash
cd summary_service
pip install -r requirements.txt
```

**3. One-time NLTK download (if you haven't already)**
```bash
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab')"
```

**4. Start the service**
```bash
# Old way (Flask):   python main.py
# New way (FastAPI):
uvicorn main:app --reload --port 5001
```

**5. Verify**
Open http://localhost:5001/docs — you'll see the full Swagger UI.
Or: `curl http://localhost:5001/health`

---

## Part 2 — Chrome Extension

### Loading the extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this zip
5. You'll see the Websears icon appear in your toolbar

### Using it

1. **Click the Websears icon** in your Chrome toolbar → the sidebar opens
2. The sidebar automatically grabs the page you're on
3. Pick a model from the dropdown and click **✦ Summarize this page**

### First-time setup: connecting to your local server

The green/red dot in the top bar shows if your local server is reachable.

- If it shows **offline**: make sure you ran `uvicorn main:app --port 5001`
- If you changed the port, go to **Settings** tab → update the Server URL → click **Test**

### Adding cloud API keys (optional)

In the **Settings** tab, paste your API keys:
- **OpenAI**: get from https://platform.openai.com/api-keys
- **Google Gemini**: get from https://aistudio.google.com/app/apikey
- **Anthropic**: get from https://console.anthropic.com/settings/keys

Keys are stored locally in Chrome's storage — never sent anywhere except the respective API.

Once saved, those providers appear in the model dropdown on the Summarize and Upload tabs.

---

## Running everything together

You need three processes running simultaneously:

| Process | Command | Port |
|---|---|---|
| Python summary service | `uvicorn main:app --port 5001` (in `summary_service/`) | 5001 |
| Node/Express backend | `npx ts-node server.ts` (in `server/`) | 5000 |
| React frontend (Vite) | `npm run dev` (in `client/`) | 5173 |

The Chrome extension talks directly to port 5001 (bypasses Express entirely).
The Express server also calls port 5001 when it routes "summarize" keywords.

---

## How page content is extracted

When you open the sidebar on a page, `content.js` runs in the page context and:
1. Removes `<script>`, `<style>`, `<nav>`, `<footer>`, `<aside>` elements
2. Prefers `<article>` or `<main>` content over the full body
3. Returns clean plain text to the sidebar

The sidebar then POSTs that text to `/summarize/selective` with your chosen model.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot access this page" | Chrome blocks extension scripts on `chrome://` and `chrome-extension://` pages — open a normal website |
| Server dot stays red | Run `uvicorn main:app --port 5001` and check for Python errors |
| Cloud options greyed out | Add API keys in Settings tab first |
| PDF upload fails for cloud models | Cloud PDF support requires the local server — use a local model or convert PDF to .txt |
| CORS error in console | The FastAPI server has `allow_origins=["*"]` — check you're hitting port 5001 not 5000 |
