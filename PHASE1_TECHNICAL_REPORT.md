# Web-Summariser Phase 1 Technical Report

## 1. Purpose

This document explains how the project is wired end-to-end:

1. How frontend and backend are connected
2. What libraries are used and why
3. How extension logic works
4. How summarization models work
5. What training data claims are valid for this phase

## 2. System Components

### 2.1 Chrome Extension

Location: extension/

Main files:

1. manifest.json
2. background.js
3. content.js
4. sidebar.html
5. sidebar.js

Responsibilities:

1. Extract text from active web pages
2. Display summarization UI in side panel
3. Call local summary service (FastAPI), Ollama, or cloud APIs
4. Store settings/history in chrome.storage.local

### 2.2 Python Summary Service

Location: summary_service/

Main files:

1. main.py (FastAPI app)
2. bart.py
3. T5.py
4. extractive_summary.py

Responsibilities:

1. Serve /health and model endpoints
2. Run local summarization models
3. Support text and file uploads (.txt, .pdf)
4. Return combined and structured summary outputs

### 2.3 Node/Express Backend

Location: server/

Main file: server.ts

Responsibilities:

1. Auth/session handling
2. Folder/chat/conversation APIs
3. MySQL persistence via Sequelize
4. Optional DB bypass for phase 1 using ALLOW_START_WITHOUT_DB=true

### 2.4 React Frontend

Location: client/

Responsibilities:

1. Web app interface for app-level flows
2. Authentication and dashboard pages
3. Calls Express backend APIs

## 3. Frontend-Backend Connectivity

## 3.1 Extension -> Python Service (direct)

Primary local summarization path:

1. Extension extracts page text in content.js
2. sidebar.js calls FastAPI endpoints on http://localhost:5001
3. Endpoints used:
- GET /health
- POST /summarize
- POST /summarize/selective
- POST /summarize/url

Why direct call:

1. Lower latency for summarization
2. Keeps extension model selection simple
3. Avoids extra relay through Express for local model requests

## 3.2 Extension -> Ollama (direct via background proxy)

Flow:

1. sidebar.js asks background.js with OLLAMA_FETCH
2. background.js performs fetch to Ollama URL
3. Response is returned to sidebar.js

Why background proxy:

1. Better reliability with extension network/CORS constraints
2. Centralized error handling for local LLM calls

## 3.3 React Client -> Express Backend

Flow:

1. React app runs on localhost:5173
2. Express backend runs on localhost:5000
3. CORS in server.ts allows frontend origin

## 4. Libraries Used and Why

## 4.1 Extension / UI Layer

1. Chrome Extensions API (MV3)
- side panel UI, tab events, storage, background worker

2. PDF.js (loaded via CDN in sidebar.js)
- extracts text client-side from uploaded PDFs when using cloud providers

## 4.2 Python Summary Service

1. FastAPI + Uvicorn
- modern async API server
- auto docs and easy validation

2. transformers + torch
- BART and T5 summarization pipelines

3. sumy + nltk
- LexRank extractive summarization

4. pypdf
- server-side PDF text extraction

## 4.3 Node Backend

1. express
- API server foundation

2. sequelize + mysql2
- ORM and MySQL connector

3. passport + oauth strategies
- auth integrations

4. multer
- multipart upload handling

5. jsonwebtoken, bcryptjs, cookie-parser, express-session
- auth/session/token/password infrastructure

## 4.4 React Client

1. react + react-router-dom
- SPA and routing

2. tailwind + radix ui primitives
- component styling and accessible UI primitives

3. react-hook-form + zod
- forms and schema validation

## 5. Extension Logic (Phase 1)

Core behavior implemented in sidebar.js/background.js/content.js:

1. Active-page capture
- on tab activation/update and SPA route changes
- background retry/cache to avoid missed reads

2. Summarization lock
- when summary starts, content snapshot is locked
- tab switching does not change in-progress summary input

3. Output formatting
- raw summary parsed into key points + overview
- optional model breakdown sections shown for combined local mode

4. Export
- TXT download
- printable HTML flow for PDF export

5. Persisted user state
- theme mode
- API keys
- summary history

## 6. Model Details

## 6.1 BART model

Model: facebook/bart-large-cnn
Type: abstractive summarization
Usage in project:

1. Chunking for long text (~700 words per chunk)
2. Per-chunk summarization
3. Optional final condensation pass

## 6.2 T5 model

Model: t5-base
Type: abstractive summarization
Usage in project:

1. Chunking for long text (~300 words per chunk)
2. Per-chunk summarization
3. Optional final condensation pass

## 6.3 LexRank model

Model: sumy LexRankSummarizer
Type: extractive summarization
Usage in project:

1. Select representative sentences from source text
2. Number of output sentences is dynamic by document length

## 6.4 Combined mode

Combined strategy in main.py:

1. Generate BART summary
2. Generate T5 summary
3. Generate LexRank summary
4. Merge and deduplicate sentences
5. Run extractive pass to produce final clean summary

## 7. Training Data and Claim Guidance

Important for presentations/interviews:

1. In this repository, models are NOT trained from scratch.
2. They are pretrained/fine-tuned public checkpoints used for inference.
3. No custom supervised fine-tuning pipeline is implemented in phase 1.

Public training-scale context (high level):

1. BART family pretraining was done on very large web/book/news corpora (roughly hundreds of GB of text), and the `facebook/bart-large-cnn` checkpoint is further fine-tuned for summarization on CNN/DailyMail scale data (about 287k article-summary pairs).
2. T5-base pretraining was done on C4-scale web text (roughly hundreds of GB, commonly cited around 750GB before filtering/processing).
3. LexRank is unsupervised extractive ranking and does not require model weight training in this repo.

What you can correctly say:

1. The project uses production-grade pretrained summarization models.
2. Performance comes from strong pretrained checkpoints plus custom pipeline logic (chunking, dedupe, combined voting).
3. Building a custom model from zero data or small private data will generally underperform these checkpoints unless you have significant dataset scale and compute.

What not to claim:

1. Do not claim you trained facebook/bart-large-cnn or t5-base yourself in this codebase.
2. Do not claim a custom training dataset size for this phase.

## 8. Data Flow Summary

1. User opens web page
2. Extension extracts text
3. User selects local/cloud provider
4. Request sent to selected provider
5. Result is structured in sidebar
6. User can copy, export, and revisit from history

## 9. Phase 1 Limitations

1. No custom model training job in repo
2. No benchmark suite yet (ROUGE/BERTScore evaluation not automated)
3. PDF OCR for scanned images is not included (text-layer PDFs are supported)
4. DB can be bypassed in backend for local testing

## 10. Recommended Phase 2 Upgrades

1. Add evaluation pipeline (ROUGE/BERTScore + latency tracking)
2. Add true PDF OCR fallback for image-only PDFs
3. Add model telemetry dashboard
4. Add configurable prompt templates for cloud providers
5. Add optional custom fine-tuning workflow and dataset registry
