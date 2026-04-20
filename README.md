# Web-Summariser

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)

A powerful, multi-model text summarization platform with a Chrome extension, REST API, and web interface. Supports both local ML models and cloud-based LLMs with intelligent fallback chains.

## Overview

Web-Summariser is a full-stack application that allows users to summarize web content, documents, and images using multiple summarization backends:

- **Local ML Models**: BART, T5, LexRank (offline-first, privacy-focused)
- **Local LLMs**: Ollama with llama3.2 support
- **Cloud Providers**: OpenAI, Google Gemini, Anthropic Claude, Mistral, Groq
- **Intelligent Fallback**: Automatic provider fallback if primary model fails

**Perfect for**: Privacy-conscious users, researchers, content creators, students, and anyone who needs fast, flexible text summarization.

## Key Features

### 🧠 Multiple Summarization Models
- **BART** (facebook/bart-large-cnn) - Fast, accurate neural summarization
- **T5** (t5-base) - Abstractive summarization with tunable generation length
- **LexRank** - Graph-based extractive summarization
- **Combined** - Multi-model consensus output
- **Ollama Integration** - Local LLM support (llama3.2)
- **Cloud LLMs** - OpenAI GPT, Gemini, Claude, Mistral, Groq

### 🔧 Document Processing
- **PDF Upload & Extraction** - Extract text from PDFs with fallback support
- **Image Analysis** - Lightweight BLIP vision model for image descriptions
- **Image OCR** - Extract text from images using vision models
- **Text File Support** - Direct `.txt` file summarization
- **Batch Processing** - Summarize multiple URLs/documents in one request

### 🎨 Modern UI/UX
- **Chrome Extension** - Sidebar summarizer for any website
- **6 Color Themes** - Dark, Light, Wood, Cherry, Night Blue, Shady Dark
- **Responsive Design** - Mobile-friendly React frontend
- **Real-time Updates** - Live summarization status and progress

### 💬 Interactive Features
- **Follow-up Questions** - Ask clarifying questions about summaries
- **Manual Link Input** - Combine auto-grabbed page content with additional URLs
- **Summary History** - Track and revisit past summaries
- **Export Options** - Download summaries as TXT or PDF

### 🔐 Security & Privacy
- **Offline-First Mode** - Works completely offline with local models
- **No Cloud Dependency** - Option to run everything locally
- **Timeout Protection** - 120-second safety limit on all operations
- **Protected Pages** - Automatic detection and skip of system pages (chrome://, about:*)

### 🚀 Developer-Friendly
- **REST API** - Fully documented FastAPI endpoints
- **TypeScript** - Type-safe backend and frontend code
- **Modular Architecture** - Clean separation of concerns
- **Production-Ready** - Error handling, logging, and validation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension (UI)                     │
│  • Page content extraction • Provider selection • History    │
└──────────┬──────────────────────────────────────────────────┘
           │ HTTP/JSON
┌──────────▼──────────────────────────────────────────────────┐
│              Express Backend (Node.js, 5000)                │
│  • Auth (Passport + JWT) • Chat history • Folders & Conv.   │
└──────────┬──────────────────────────────────────────────────┘
           │ Internal API
┌──────────▼──────────────────────────────────────────────────┐
│         Python Summary Service (FastAPI, 5001)              │
│  • BART/T5/LexRank • Ollama integration • PDF/Image handler │
└─────────────────────────────────────────────────────────────┘
           │
    ┌──────┴──────────┬──────────────────┬─────────────┐
    │                 │                  │             │
  Local Models    Ollama (local)    Cloud LLMs      Browser
  (Hugging Face)   (11434)          (API keys)     (Optional)
```

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component library
- **React Router** - Client-side navigation

### Backend
- **Express.js** - RESTful API server
- **TypeScript** - Type safety
- **Passport.js** - Authentication (JWT, OAuth)
- **MySQL/Sequelize** - Data persistence (optional)

### Python Service
- **FastAPI** - High-performance API framework
- **Uvicorn** - ASGI server
- **Transformers (Hugging Face)** - Pre-trained models
- **PyTorch** - ML inference engine
- **pdfplumber/pypdf** - PDF text extraction
- **BLIP** - Vision model for image analysis

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+ (with pip or conda)
- **Chrome** browser (for extension testing)
- **Git** (for cloning the repository)
- **4GB RAM** minimum (8GB+ recommended for local models)
- **Ollama** (optional, for local LLM support)
- **MySQL** (optional, for persistent data storage)

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/Web-Summariser.git
cd Web-Summariser
```

### 2. Set Up Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\Activate.ps1

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download required NLTK tokenizer
python -c "import nltk; nltk.download('punkt')"
```

### 3. Install JavaScript Dependencies

```bash
# Server
cd server
npm install
cd ..

# Client
cd client
npm install
cd ..
```

### 4. Environment Configuration

Create `.env` files in `server/` and `extension/` directories:

**server/.env:**
```env
# Database (optional)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=summariser
ALLOW_START_WITHOUT_DB=true

# JWT Secret
JWT_SECRET=your-secret-key-here

# OAuth (optional)
GOOGLE_CLIENT_ID=your-google-id
GOOGLE_CLIENT_SECRET=your-google-secret
FACEBOOK_APP_ID=your-facebook-id
FACEBOOK_APP_SECRET=your-facebook-secret
```

**extension/.env (or settings in extension):**
```
OPENAI_API_KEY=your-key
GEMINI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
MISTRAL_API_KEY=your-key
GROQ_API_KEY=your-key
```

## Quick Start

### Start All Services (PowerShell)

```powershell
# Terminal 1: Python Summary Service
cd summary_service
uvicorn main:app --reload --port 5001

# Terminal 2: Express Backend
cd server
$env:ALLOW_START_WITHOUT_DB='true'
npx ts-node server.ts

# Terminal 3: React Frontend (optional)
cd client
npm run dev

# Terminal 4: Ollama (optional)
ollama serve
```

### Access Points

- **Extension**: `chrome://extensions` → Load unpacked → Select `extension/` folder
- **Web UI**: http://localhost:5173 (React client)
- **API Docs**: http://localhost:5001/docs (FastAPI Swagger)
- **Backend API**: http://localhost:5000

### Verify Installation

```bash
# Check Python service health
curl http://localhost:5001/health

# Check backend health
curl http://localhost:5000/health

# View available models
curl http://localhost:5001/models
```

## Usage Guide

### Chrome Extension (Recommended)

1. **Load Extension**
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/` folder

2. **Basic Summarization**
   - Navigate to any website
   - Click extension icon → Open side panel
   - Select your preferred model/provider
   - Click "Summarize this page"
   - Wait for results

3. **Upload Documents**
   - Click "Upload" tab
   - Upload `.pdf` or `.txt` files
   - Select summarization method
   - Download results as TXT or PDF

4. **Follow-up Questions**
   - After summarization, use the query panel
   - Ask follow-up questions about the summary
   - Responses use the same model/provider

5. **Configure API Keys**
   - Click "Settings" tab
   - Enter API keys for cloud providers
   - Keys are stored locally (not sent to servers)

### Web API

#### Summarize Text

```bash
curl -X POST http://localhost:5001/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your text here...",
    "model": "bart",
    "length": 100
  }'
```

#### Upload PDF

```bash
curl -X POST http://localhost:5001/upload/pdf \
  -F "file=@document.pdf" \
  -F "model=t5" \
  -F "length=150"
```

#### Extract Image Text

```bash
curl -X POST http://localhost:5001/upload/image/extract-text \
  -F "file=@image.png"
```

#### Get Available Models

```bash
curl http://localhost:5001/models
```

See `AI_docs/` folder for detailed API documentation and examples.

## Project Structure

```
Web-Summariser/
├── extension/                    # Chrome Extension
│   ├── manifest.json            # Extension configuration
│   ├── sidebar.html             # UI panel
│   ├── sidebar.js               # Extension logic
│   ├── content.js               # Page content extraction
│   └── background.js            # Service worker
│
├── server/                       # Express Backend
│   ├── server.ts                # Main server file
│   ├── database.ts              # DB initialization
│   ├── models/                  # Data models
│   │   ├── Users.ts
│   │   ├── Conversations.ts
│   │   ├── Messages.ts
│   │   └── Folders.ts
│   ├── routes/                  # API endpoints
│   │   ├── auth.ts
│   │   ├── chats.ts
│   │   ├── conversation.ts
│   │   └── folder.ts
│   ├── middleware/              # Express middleware
│   │   ├── authMiddleware.ts
│   │   ├── upload.ts            # File upload handling
│   │   └── ...
│   └── Auth/                    # Authentication
│       ├── Passport.ts
│       └── JwtTokens.ts
│
├── client/                       # React Frontend
│   ├── src/
│   │   ├── App.tsx              # Main component
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Page components
│   │   ├── services/            # API clients
│   │   ├── hooks/               # Custom React hooks
│   │   └── context/             # React context
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── summary_service/              # Python FastAPI Service
│   ├── main.py                  # API entry point
│   ├── pdf_handler.py           # PDF extraction
│   ├── image_analyzer.py        # Vision model
│   ├── llama_detector.py        # Ollama support
│   ├── bart.py                  # BART summarization
│   ├── T5.py                    # T5 summarization
│   ├── extractive_summary.py    # LexRank summarization
│   └── requirements.txt
│
├── AI_docs/                      # Documentation
│   ├── START_HERE.md
│   ├── ARCHITECTURE.md
│   ├── DATA_PROCESSING_PIPELINE.md
│   ├── BATCH_LOGGING_GUIDE.md
│   └── ...
│
└── requirements.txt             # Python dependencies
```

## Configuration

### Local Models

Models are downloaded automatically on first use. To pre-download:

```bash
python -c "from transformers import AutoModel; AutoModel.from_pretrained('facebook/bart-large-cnn')"
python -c "from transformers import AutoModel; AutoModel.from_pretrained('t5-base')"
```

### Ollama Setup

```bash
# Install Ollama (https://ollama.ai)
# Pull model
ollama pull llama3.2

# Set CORS headers for browser access
$env:OLLAMA_ORIGINS='*'
ollama serve

# Test Ollama connection
curl http://localhost:11434/api/tags
```

### Cloud Provider API Keys

1. **OpenAI**: https://platform.openai.com/api-keys
2. **Google Gemini**: https://makersuite.google.com/app/apikey
3. **Anthropic Claude**: https://console.anthropic.com/account/keys
4. **Mistral**: https://console.mistral.ai/api-keys/
5. **Groq**: https://console.groq.com/keys

Add keys to extension Settings or server environment variables.

## Performance Tips

- **Use Local Models** for privacy and offline capability
- **Enable GPU** (CUDA/Metal) for faster inference (update torch as needed)
- **Pre-warm Models** by running a test summarization before production use
- **Batch Requests** for multiple documents to reduce latency
- **Monitor Memory** - BART/T5 require 4GB+ RAM; consider quantized models for lower specs

## Troubleshooting

### Issue: Models Download on First Use (Takes Time)

**Solution**: Models are cached after first download. Pre-download them:
```bash
python -c "import nltk; nltk.download('punkt')"
python summary_service/main.py &
# Wait for startup, then Ctrl+C
```

### Issue: "Import torch failed" or CUDA errors

**Solution**: Reinstall torch for your system:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

### Issue: PDF Extraction Fails

**Solution**: Ensure dependencies are installed:
```bash
pip install pdfplumber pypdf pillow --upgrade
```

### Issue: Extension Sidebar Doesn't Open

**Solution**:
1. Verify extension is loaded at `chrome://extensions`
2. Check browser console for errors (F12 → Console)
3. Reload extension (toggle on/off in extensions page)
4. Clear extension storage: `chrome://extensions` → Extension Options

### Issue: "Ollama Connection Refused"

**Solution**: 
```bash
# Ensure Ollama is running
ollama serve

# Check it's accessible
curl http://localhost:11434/api/tags

# Enable CORS
$env:OLLAMA_ORIGINS='*'
ollama serve
```

### Issue: Timeout on Large Documents

**Solution**: 
- Use LexRank for faster extraction summaries
- Reduce document size or split into chunks
- Try cloud models (faster) instead of local
- Check system RAM and CPU availability

## API Endpoints

### Summary Service (Port 5001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/models` | Available summarization models |
| POST | `/summarize` | Summarize text content |
| POST | `/upload/pdf` | Upload and summarize PDF |
| POST | `/upload/image` | Analyze image content |
| POST | `/upload/image/extract-text` | Extract text from image |
| POST | `/extract/pdf` | Extract PDF text (no summarization) |

### Backend API (Port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | User registration |
| POST | `/auth/login` | User login |
| POST | `/auth/logout` | User logout |
| GET | `/conversation` | Get user conversations |
| POST | `/conversation` | Create new conversation |
| GET | `/chats/:id` | Get chat messages |
| POST | `/chats` | Create chat message |
| GET | `/folders` | Get user folders |
| POST | `/folders` | Create folder |

## Advanced Features

### Batch Logging

The system includes comprehensive batch logging for debugging and monitoring:

```bash
# See AI_docs/BATCH_LOGGING_GUIDE.md
python demo_batch_logging.py
```

### Custom Model Fine-tuning

You can fine-tune local models on your own data. See `AI_docs/EXTENSION_LLAMA_INTEGRATION.md` for examples.

### Integration with External Tools

Web-Summariser can be integrated with:
- **Slack**: Post summaries to channels
- **Notion**: Save summaries to Notion databases
- **Email**: Send summaries via email
- **Zapier**: Create automation workflows

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Web-Summariser.git
cd Web-Summariser

# Create feature branch
git checkout -b feature/your-feature

# Install dev dependencies (if applicable)
npm install --save-dev  # for Node projects
pip install pytest pytest-cov  # for Python
```

### Code Guidelines

- Follow PEP 8 (Python) and Prettier (JavaScript)
- Add tests for new features
- Update documentation
- Ensure existing tests pass

## Roadmap

- [ ] Support for more local LLMs (Mixtral, Zephyr)
- [ ] Web-based dashboard for team collaboration
- [ ] Browser extension for Firefox and Safari
- [ ] Document comparison and diff views
- [ ] Advanced analytics and insights
- [ ] Plugin system for custom models
- [ ] Multi-language support
- [ ] Real-time collaborative summarization

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

You are free to:
- ✅ Use commercially
- ✅ Modify the code
- ✅ Distribute copies
- ✅ Use privately

With the condition that you include the license notice.

## Citation

If you use Web-Summariser in your research or project, please cite it as:

```bibtex
@software{web_summariser,
  title={Web-Summariser: Multi-Model Text Summarization Platform},
  author={Your Name},
  year={2026},
  url={https://github.com/yourusername/Web-Summariser}
}
```

## Support & Community

- **Issues**: [Report bugs](https://github.com/yourusername/Web-Summariser/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/Web-Summariser/discussions)
- **Documentation**: See `AI_docs/` folder
- **Email**: your.email@example.com

## Acknowledgments

- **Hugging Face** - Pre-trained models (BART, T5)
- **Facebook Research** - BART architecture
- **Google Research** - T5 model
- **Ollama** - Local LLM support
- **FastAPI** - Web framework
- **React** - UI library

---

**Made with ❤️ for the open-source community**
