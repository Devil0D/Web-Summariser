// sidebar.js

const ALL_PROVIDERS = ["openai","gemini","anthropic","mistral","groq","cohere"];
const GEMINI_MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
];

const state = {
  pageText:    "",
  pageTitle:   "",
  pageUrl:     "",
  serverUrl:   "http://localhost:5001",
  ollamaUrl:   "http://localhost:11434",
  serverOnline: false,
  selectedFile: null,
  keys: Object.fromEntries(ALL_PROVIDERS.map(p => [p, ""])),
};

const $ = id => document.getElementById(id);

const tabs         = document.querySelectorAll(".tab");
const panels       = document.querySelectorAll(".panel");
const serverDot    = $("server-dot");
const serverText   = $("server-status-text");
const summarizeBtn = $("summarize-btn");
const resultBox    = $("result-container");
const errorBox     = $("error-box");

// ── tabs ──────────────────────────────────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    $(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

$("settings-shortcut").addEventListener("click", () => {
  tabs.forEach(t => t.classList.remove("active"));
  panels.forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="settings"]').classList.add("active");
  $("panel-settings").classList.add("active");
});

// ── settings load ─────────────────────────────────────────────────────────────
async function loadSettings() {
  const data = await chrome.storage.local.get(["serverUrl","ollamaUrl","keys"]);
  if (data.serverUrl) {
    state.serverUrl = data.serverUrl;
    $("server-url-input").value = data.serverUrl;
  }
  if (data.ollamaUrl) {
    state.ollamaUrl = data.ollamaUrl;
  }
  if ($("ollama-url-input")) {
    $("ollama-url-input").value = state.ollamaUrl;
  }
  if (data.keys) {
    state.keys = { ...state.keys, ...data.keys };
    ALL_PROVIDERS.forEach(k => {
      if (state.keys[k]) {
        $(`key-${k}`).value = "••••••••••••";
        $(`badge-${k}`).classList.add("visible");
        enableCloudOption(k);
      }
    });
  }
}

function enableCloudOption(provider) {
  [$(`opt-${provider}`), $(`uopt-${provider}`)].forEach(el => {
    if (!el) return;
    el.disabled = false;
    el.textContent = el.textContent.replace(" (add key →)", "");
  });
}

// ── server health ─────────────────────────────────────────────────────────────
async function checkServer() {
  serverDot.className = "status-dot checking";
  serverText.textContent = "Checking local server…";
  try {
    const r = await fetch(`${state.serverUrl}/health`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      serverDot.className = "status-dot ok";
      serverText.textContent = "Local server online";
      state.serverOnline = true;
      return true;
    }
  } catch (_) {}
  serverDot.className = "status-dot";
  serverText.textContent = "Local server offline";
  state.serverOnline = false;
  return false;
}

// ── page content ──────────────────────────────────────────────────────────────
async function grabPageContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    $("page-title").textContent = tab.title || "";
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTENT" });
    if (response) {
      state.pageText  = response.text  || "";
      state.pageTitle = response.title || tab.title || "";
      state.pageUrl   = response.url   || tab.url  || "";
      updatePageCard();
    }
  } catch (_) {
    $("pi-title").textContent = "Cannot access this page";
    $("pi-url").textContent   = "";
    $("pi-meta").textContent  = "";
  }
}

function updatePageCard() {
  $("pi-title").textContent = state.pageTitle || "Untitled page";
  $("pi-url").textContent   = state.pageUrl;
  const words = state.pageText.split(/\s+/).filter(Boolean).length;
  $("pi-meta").textContent  = words ? `~${words.toLocaleString()} words extracted` : "";
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "PAGE_CONTENT") {
    state.pageText  = msg.text  || "";
    state.pageTitle = msg.title || "";
    state.pageUrl   = msg.url   || "";
    updatePageCard();
  }
});

// ── helpers ───────────────────────────────────────────────────────────────────
function parseModelSelect(value) {
  const [provider, model] = value.split(":");
  return { provider, model };
}

function backgroundMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function fetchOllamaViaBackground(url, options = {}) {
  const response = await backgroundMessage({ type: "OLLAMA_FETCH", url, options });

  if (!response) {
    throw new Error("Ollama request failed: empty response from extension background.");
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Ollama 403 (CORS): restart Ollama with extension origins allowed.\n" +
        "PowerShell:\n" +
        "1) taskkill /IM ollama.exe /F\n" +
        "2) $env:OLLAMA_ORIGINS='*'\n" +
        "3) ollama serve"
      );
    }
    if (response.status === 0) {
      throw new Error(`Ollama: Failed to connect — ${response.error || "unknown network error"}`);
    }
    throw new Error(
      response?.data?.error?.message ||
      response?.data?.message ||
      `Ollama ${response.status}`
    );
  }

  return response.data || {};
}

async function fetchJsonWithError(url, options, fallbackLabel) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (e) {
    if (fallbackLabel === "Ollama") {
      throw new Error(
        "Ollama: Failed to connect. Possible causes:\n" +
        "1. Run: ollama serve\n" +
        "2. CORS blocked — restart Ollama with:\n" +
        "   $env:OLLAMA_ORIGINS=\"chrome-extension://*\"; ollama serve"
      );
    }
    throw new Error(`${fallbackLabel}: Failed to fetch — ${e.message}`);
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (fallbackLabel === "Ollama" && response.status === 403) {
      throw new Error(
        "Ollama 403 (CORS): restart Ollama with extension origins allowed.\n" +
        "PowerShell:\n" +
        "1) taskkill /IM ollama.exe /F\n" +
        "2) $env:OLLAMA_ORIGINS='*'\n" +
        "3) ollama serve\n" +
        "Then reload the Chrome extension."
      );
    }
    throw new Error(
      json?.error?.message || json?.message || `${fallbackLabel} ${response.status}`
    );
  }
  return json;
}

function showError(box, msg) { box.textContent = msg; box.classList.add("visible"); }
function hideError(box) { box.classList.remove("visible"); }
function setLoading(btn, on) { btn.disabled = on; btn.classList.toggle("spinning", on); }

function displayResults(data, isCloud = false) {
  resultBox.classList.add("visible");
  const final = isCloud ? data.summary : (data.final_summary || data.summary || "");
  $("text-final").textContent = final;
  const showBreakdown = !isCloud && data.bart_summary;
  ["bart","t5","lexrank"].forEach(m => {
    $(`section-${m}`).style.display = showBreakdown ? "block" : "none";
  });
  if (showBreakdown) {
    $("text-bart").textContent    = data.bart_summary        || "";
    $("text-t5").textContent      = data.t5_summary          || "";
    $("text-lexrank").textContent = data.extractive_summary  || "";
  }
}

// ── local model ───────────────────────────────────────────────────────────────
async function callLocalModel(text, model) {
  if (model === "combined") {
    const form = new FormData();
    form.append("text", text);
    const r = await fetch(`${state.serverUrl}/summarize`, { method:"POST", body:form });
    if (!r.ok) throw new Error(`Server error ${r.status}: ${await r.text()}`);
    return r.json();
  }
  const r = await fetch(`${state.serverUrl}/summarize/selective`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ text, model }),
  });
  if (!r.ok) throw new Error(`Server error ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── cloud API calls ───────────────────────────────────────────────────────────
const PROMPT = (text) =>
  `Summarize the following text concisely. Return only the summary, no preamble:\n\n${text.slice(0, 12000)}`;

async function callOpenAI(text, key) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
    body: JSON.stringify({
      model:"gpt-4o", max_tokens:500,
      messages:[
        { role:"system", content:"You are a concise summarization assistant." },
        { role:"user",   content:PROMPT(text) },
      ],
    }),
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||`OpenAI ${r.status}`); }
  const d = await r.json();
  return { summary: d.choices[0].message.content };
}

async function callGemini(text, key) {
  let lastError = null;

  for (const model of GEMINI_MODEL_CANDIDATES) {
    try {
      const data = await fetchJsonWithError(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ contents:[{ parts:[{ text: PROMPT(text) }] }] }),
        },
        "Gemini"
      );

      const summary = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n").trim();
      if (!summary) {
        throw new Error(`Gemini returned an empty response for ${model}.`);
      }

      return { summary, model_used: model };
    } catch (error) {
      lastError = error;
      const message = (error?.message || String(error)).toLowerCase();
      if (
        message.includes("not found") ||
        message.includes("not supported") ||
        message.includes("unsupported")
      ) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error("Unable to find a supported Gemini model for this API key.");
}

async function callAnthropic(text, key) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-api-key":key, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({
      model:"claude-3-5-haiku-20241022", max_tokens:500,
      messages:[{ role:"user", content:PROMPT(text) }],
    }),
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||`Anthropic ${r.status}`); }
  const d = await r.json();
  return { summary: d.content[0].text };
}

async function callOllama(text) {
  const baseUrl = state.ollamaUrl.replace(/\/$/, "");
  const data = await fetchOllamaViaBackground(`${baseUrl}/api/generate`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      model:"llama3.2",
      prompt:PROMPT(text),
      stream:false,
    }),
  });

  if (!data?.response) {
    throw new Error(
      "Ollama: No response text received. Run `ollama pull llama3.2` to ensure the model is downloaded."
    );
  }

  return { summary: data.response, model_used: "llama3.2" };
}

async function callMistral(text, key) {
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
    body: JSON.stringify({
      model:"mistral-small-latest", max_tokens:500,
      messages:[{ role:"user", content:PROMPT(text) }],
    }),
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||`Mistral ${r.status}`); }
  const d = await r.json();
  return { summary: d.choices[0].message.content };
}

async function callGroq(text, key) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
    body: JSON.stringify({
      model:"llama3-8b-8192", max_tokens:500,
      messages:[
        { role:"system", content:"You are a concise summarization assistant." },
        { role:"user",   content:PROMPT(text) },
      ],
    }),
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||`Groq ${r.status}`); }
  const d = await r.json();
  return { summary: d.choices[0].message.content };
}

async function callCohere(text, key) {
  const r = await fetch("https://api.cohere.com/v2/chat", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
    body: JSON.stringify({
      model:"command-r", max_tokens:500,
      messages:[{ role:"user", content:PROMPT(text) }],
    }),
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.message||`Cohere ${r.status}`); }
  const d = await r.json();
  return { summary: d.message?.content?.[0]?.text || d.text || "" };
}

const CLOUD_CALLERS = { openai:callOpenAI, gemini:callGemini, anthropic:callAnthropic,
                        mistral:callMistral, groq:callGroq, cohere:callCohere, ollama:callOllama };

async function callCloud(provider, text) {
  if (provider === "ollama") {
    return callOllama(text);
  }
  const key = state.keys[provider];
  if (!key) throw new Error(`No ${provider} API key saved. Go to Settings ⚙ to add it.`);
  const fn = CLOUD_CALLERS[provider];
  if (!fn) throw new Error(`Unknown provider: ${provider}`);
  return fn(text, key);
}

// ── summarize page ────────────────────────────────────────────────────────────
summarizeBtn.addEventListener("click", async () => {
  hideError(errorBox);
  resultBox.classList.remove("visible");

  if (!state.pageText) {
    showError(errorBox, "No page content found. Try clicking ↺ to refresh.");
    return;
  }

  const { provider, model } = parseModelSelect($("model-select").value);
  setLoading(summarizeBtn, true);

  try {
    let data;
    if (provider === "local") {
      if (!state.serverOnline) {
        const online = await checkServer();
        if (!online) throw new Error(
          "Local server is offline.\nRun this in your summary_service folder:\n\n  uvicorn main:app --port 5001"
        );
      }
      data = await callLocalModel(state.pageText, model);
      displayResults(data, false);
    } else {
      data = await callCloud(model, state.pageText);
      displayResults(data, true);
    }
  } catch (err) {
    showError(errorBox, err.message || String(err));
  } finally {
    setLoading(summarizeBtn, false);
  }
});

// ── upload panel ──────────────────────────────────────────────────────────────
const dropZone     = $("drop-zone");
const fileInput    = $("file-input");
const filePreview  = $("file-preview");
const uploadBtn    = $("upload-summarize-btn");
const uploadError  = $("upload-error-box");
const uploadResult = $("upload-result-container");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault(); dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

function setFile(file) {
  if (!file.name.match(/\.(txt|pdf)$/i)) {
    showError(uploadError, "Only .txt and .pdf files are supported."); return;
  }
  state.selectedFile = file;
  $("file-name-display").textContent = `${file.name}  (${(file.size/1024).toFixed(1)} KB)`;
  filePreview.classList.add("visible");
  uploadBtn.disabled = false;
  hideError(uploadError);
}

$("remove-file-btn").addEventListener("click", () => {
  state.selectedFile = null; fileInput.value = "";
  filePreview.classList.remove("visible");
  uploadBtn.disabled = true; uploadResult.style.display = "none";
});

uploadBtn.addEventListener("click", async () => {
  if (!state.selectedFile) return;
  hideError(uploadError); uploadResult.style.display = "none";
  setLoading(uploadBtn, true);

  const { provider, model } = parseModelSelect($("upload-model-select").value);

  try {
    let summary = "";

    if (provider === "local") {
      // Local: send file directly to Python server (handles PDF server-side)
      if (!state.serverOnline) {
        const online = await checkServer();
        if (!online) throw new Error("Local server offline. Run: uvicorn main:app --port 5001");
      }
      const form = new FormData();
      form.append("file", state.selectedFile, state.selectedFile.name);
      form.append("model", model);
      const r = await fetch(`${state.serverUrl}/summarize`, { method:"POST", body:form });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`Server error ${r.status}: ${body}`);
      }
      const d = await r.json();
      summary = d.final_summary || d.summary || "";

    } else {
      // Cloud: extract text in-browser first, then call the API
      const text = await readFileAsText(state.selectedFile);
      if (!text.trim()) throw new Error("No text could be extracted from this file.");
      const d = await callCloud(model, text);
      summary = d.summary;
    }

    $("upload-text-final").textContent = summary;
    uploadResult.style.display = "flex";
  } catch (err) {
    showError(uploadError, err.message || String(err));
  } finally {
    setLoading(uploadBtn, false);
  }
});

/**
 * Read any file as plain text.
 * .txt  → FileReader directly
 * .pdf  → PDF.js loaded from CDN, extracts all page text in-browser
 */
async function readFileAsText(file) {
  const isPdf = file.name.toLowerCase().endsWith(".pdf") ||
                file.type === "application/pdf";

  if (!isPdf) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = e => res(e.target.result);
      reader.onerror = () => rej(new Error("Could not read file"));
      reader.readAsText(file, "utf-8");
    });
  }

  // ── PDF: use PDF.js via CDN ───────────────────────────────────────────────
  // Load PDF.js only once
  if (!window.pdfjsLib) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = res;
      s.onerror = () => rej(new Error("Could not load PDF.js. Check your internet connection."));
      document.head.appendChild(s);
    });
    // Point worker to CDN as well
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  // Read file as ArrayBuffer
  const arrayBuffer = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = e => res(e.target.result);
    reader.onerror = () => rej(new Error("Could not read PDF file"));
    reader.readAsArrayBuffer(file);
  });

  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text    = content.items.map(item => item.str).join(" ");
    if (text.trim()) pageTexts.push(text);
  }

  if (!pageTexts.length) {
    throw new Error(
      "This PDF appears to be scanned (image-only) — no text layer found.\n" +
      "Try a local model instead, which uses pypdf on the server."
    );
  }

  return pageTexts.join("\n\n");
}

// ── copy buttons ──────────────────────────────────────────────────────────────
document.addEventListener("click", e => {
  const btn = e.target.closest(".copy-btn[data-target]");
  if (!btn) return;
  const el = $(btn.dataset.target);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const orig = btn.textContent;
    btn.textContent = "copied!";
    setTimeout(() => btn.textContent = orig, 1500);
  });
});

// ── settings ──────────────────────────────────────────────────────────────────
document.querySelectorAll(".key-save-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const provider = btn.dataset.key;
    const val = $(`key-${provider}`).value.trim();
    if (!val || val === "••••••••••••") return;
    state.keys[provider] = val;
    await chrome.storage.local.set({ keys: state.keys });
    $(`key-${provider}`).value = "••••••••••••";
    $(`badge-${provider}`).classList.add("visible");
    enableCloudOption(provider);
    btn.textContent = "✓";
    setTimeout(() => btn.textContent = "Save", 1500);
  });
});

$("test-server-btn").addEventListener("click", async () => {
  const url = $("server-url-input").value.trim();
  state.serverUrl = url;
  await chrome.storage.local.set({ serverUrl: url });
  await checkServer();
});

if ($("test-ollama-btn")) {
  $("test-ollama-btn").addEventListener("click", async () => {
    const url = $("ollama-url-input").value.trim();
    state.ollamaUrl = url;
    await chrome.storage.local.set({ ollamaUrl: url });

    try {
      const baseUrl = state.ollamaUrl.replace(/\/$/, "");
      const data = await fetchOllamaViaBackground(`${baseUrl}/api/tags`, { method:"GET" });
      const hasLlama = Array.isArray(data?.models) && data.models.some(model => model?.name?.startsWith("llama3.2"));
      if (!hasLlama) {
        throw new Error("Ollama is reachable, but `llama3.2` is not installed yet. Run: `ollama pull llama3.2`.");
      }
      alert("Ollama is reachable and llama3.2 is installed.");
    } catch (error) {
      alert(error?.message || String(error));
    }
  });
}

$("clear-keys-btn").addEventListener("click", async () => {
  if (!confirm("Clear all saved API keys?")) return;
  state.keys = Object.fromEntries(ALL_PROVIDERS.map(p => [p, ""]));
  await chrome.storage.local.remove("keys");
  ALL_PROVIDERS.forEach(k => {
    $(`key-${k}`).value = "";
    $(`badge-${k}`).classList.remove("visible");
  });
});

$("refresh-btn").addEventListener("click", grabPageContent);

// ── init ──────────────────────────────────────────────────────────────────────
(async () => {
  await loadSettings();
  await Promise.all([checkServer(), grabPageContent()]);
  setInterval(checkServer, 30_000);
})();
