# Web-Summariser

Web-Summariser is a multi-part project with:

1. Chrome Extension (sidebar summarizer for any website)
2. Python Summary Service (FastAPI + local ML models)
3. Node/Express Backend (auth, folders, chat, conversations)
4. React Frontend client (optional web UI)

## Architecture overview

1. Extension extracts readable text from the active page.
2. Extension sends text to one of:
- Local summary service on port 5001 (BART, T5, LexRank, Combined)
- Ollama on port 11434 (llama3.2)
- Cloud providers (OpenAI, Gemini, Anthropic, Mistral, Groq) if keys are set
3. Python summary service returns structured summaries and model breakdowns.
4. Express backend on port 5000 is used for app APIs (auth/folders/chats/conversations).
5. React frontend on port 5173 talks to Express backend.

## Prerequisites

1. Node.js 18+ and npm
2. Python 3.10+ (Conda or venv is fine)
3. Chrome browser for extension testing
4. Ollama installed (for local LLM mode)
5. MySQL optional for phase-1 testing (backend can run without DB using env flag)

## Step-by-step setup

### 1. Clone and install JavaScript dependencies

From project root:

```powershell
cd client
npm install

cd ..\server
npm install
```

### 2. Set up Python dependencies for summarization

From project root:

```powershell
pip install -r requirements.txt
```

If LexRank tokenizer is missing on first run:

```powershell
python -c "import nltk; nltk.download('punkt')"
```

### 3. Download local models (first run)

The Hugging Face models are downloaded automatically on first call:

1. `facebook/bart-large-cnn`
2. `t5-base`

This can take time on first request because model weights are fetched and cached locally.

### 4. Start Ollama (optional but recommended)

```powershell
ollama pull llama3.2
$env:OLLAMA_ORIGINS='*'
ollama serve
```

### 5. Start Python summary service (port 5001)

```powershell
cd summary_service
uvicorn main:app --reload --port 5001
```

Important: command is `uvicorn`, not `unicorn`.

Health check:

```powershell
curl http://localhost:5001/health
```

### 6. Start backend server (port 5000)

```powershell
cd server
$env:ALLOW_START_WITHOUT_DB='true'
npx ts-node server.ts
```

If DB is configured later, remove `ALLOW_START_WITHOUT_DB` and set real credentials in `server/.env`.

### 7. Start frontend client (port 5173, optional)

```powershell
cd client
npm run dev
```

## Chrome extension setup

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select the `extension` folder
5. Pin extension icon and open side panel

### Extension quick tutorial

1. Open any normal website (not `chrome://` pages)
2. Open extension sidebar
3. Select model/provider
4. Click Summarize this page
5. Use TXT/PDF download buttons if needed
6. For document flow, use Upload tab (`.txt` or `.pdf`)

### Add API keys (cloud providers)

In extension Settings tab:

1. Paste key into provider input
2. Click Save
3. Provider becomes selectable in model dropdown

Supported cloud providers in extension:

1. OpenAI
2. Gemini
3. Anthropic
4. Mistral
5. Groq

## Running all services together

Keep these running in parallel:

1. `uvicorn main:app --reload --port 5001` (Python summary service)
2. `npx ts-node server.ts` (Express backend, 5000)
3. `npm run dev` (React client, 5173, optional)
4. `ollama serve` (optional, local LLM provider)

## Current phase-1 notes

1. Extension supports dark/light UI, summary lock during in-progress jobs, structured bullet output, history, and TXT/PDF export.
2. Local summary pipeline supports BART, T5, LexRank, and Combined output.
3. For technical details and model notes, read `PHASE1_TECHNICAL_REPORT.md`.
