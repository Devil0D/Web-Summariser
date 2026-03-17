// sidebar.js  – Websears Summarizer

const ALL_PROVIDERS = ["openai","gemini","anthropic","mistral","groq","cohere"];
const GEMINI_MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
];

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  pageText:      "",
  pageTitle:     "",
  pageUrl:       "",
  serverUrl:     "http://localhost:5001",
  ollamaUrl:     "http://localhost:11434",
  serverOnline:  false,
  selectedFile:  null,
  isSummarizing: false,      // lock: prevent URL changes while summarizing
  lockedPageText:"",
  lockedPageTitle:"",
  lockedPageUrl: "",
  lastSummaryData: null,     // for download
  uploadLastData: null,      // for upload download
  theme: "dark",
  keys: Object.fromEntries(ALL_PROVIDERS.map(p => [p,""])),
};

const $ = id => document.getElementById(id);

const tabs         = document.querySelectorAll(".tab");
const panels       = document.querySelectorAll(".panel");
const serverDot    = $("server-dot");
const serverText   = $("server-status-text");
const summarizeBtn = $("summarize-btn");
const resultBox    = $("result-container");
const errorBox     = $("error-box");

// ── Tabs ─────────────────────────────────────────────────────────────────────
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

// Collapsible breakdown sections
document.addEventListener("click", e => {
  const header = e.target.closest(".breakdown-header[data-collapse]");
  if (!header) return;
  const body = $(header.dataset.collapse);
  if (body) body.classList.toggle("open");
});

// ── Theme toggle ─────────────────────────────────────────────────────────────
$("theme-toggle").addEventListener("click", async () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme(state.theme);
  await chrome.storage.local.set({ theme: state.theme });
});

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  $("theme-toggle").textContent = theme === "dark" ? "☀" : "🌙";
}

// ── Settings load ─────────────────────────────────────────────────────────────
async function loadSettings() {
  const data = await chrome.storage.local.get(["serverUrl","ollamaUrl","keys","theme"]);
  if (data.serverUrl) {
    state.serverUrl = data.serverUrl;
    $("server-url-input").value = data.serverUrl;
  }
  if (data.ollamaUrl) {
    state.ollamaUrl = data.ollamaUrl;
  }
  if ($("ollama-url-input")) $("ollama-url-input").value = state.ollamaUrl;
  if (data.keys) {
    state.keys = { ...state.keys, ...data.keys };
    ALL_PROVIDERS.forEach(k => {
      if (state.keys[k]) {
        const el = $(`key-${k}`);
        if (el) el.value = "••••••••••••";
        const badge = $(`badge-${k}`);
        if (badge) badge.classList.add("visible");
        enableCloudOption(k);
      }
    });
  }
  if (data.theme) {
    state.theme = data.theme;
    applyTheme(state.theme);
  }
}

function enableCloudOption(provider) {
  [$(`opt-${provider}`), $(`uopt-${provider}`)].forEach(el => {
    if (!el) return;
    el.disabled = false;
    el.textContent = el.textContent.replace(" (add key →)", "");
  });
}

// ── Server health ─────────────────────────────────────────────────────────────
async function checkServer(silent = false) {
  if (!silent) {
    serverDot.className = "status-dot checking";
    serverText.textContent = "Checking local server…";
  }
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

// ── Page content ──────────────────────────────────────────────────────────────
async function grabPageContent() {
  // If a summarization is in progress, don't change the page content
  if (state.isSummarizing) return;

  try {
    const payload = await backgroundMessage({ type: "GET_ACTIVE_PAGE_CONTENT" });
    if (!payload?.ok || !payload?.data) {
      throw new Error(payload?.error || "Could not read current page content.");
    }
    const response = payload.data;
    if (response) {
      state.pageText  = response.text  || "";
      state.pageTitle = response.title || "";
      state.pageUrl   = response.url   || "";
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

// Listen for PAGE_CONTENT pushed by content.js / background (tab switch)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "PAGE_CONTENT") {
    // Respect summarization lock
    if (state.isSummarizing) return;
    state.pageText  = msg.text  || "";
    state.pageTitle = msg.title || "";
    state.pageUrl   = msg.url   || "";
    updatePageCard();
  }
});

// Also poll on tab activation for quick updates
chrome.tabs.onActivated?.addListener(() => {
  if (!state.isSummarizing) grabPageContent();
});

// ── Lock/unlock helpers ───────────────────────────────────────────────────────
function lockForSummarization() {
  state.isSummarizing    = true;
  state.lockedPageText   = state.pageText;
  state.lockedPageTitle  = state.pageTitle;
  state.lockedPageUrl    = state.pageUrl;
  $("lock-indicator").classList.add("visible");
  $("progress-banner").classList.add("visible");
  $("refresh-btn").disabled = true;
}

function unlockAfterSummarization() {
  state.isSummarizing = false;
  $("lock-indicator").classList.remove("visible");
  $("progress-banner").classList.remove("visible");
  $("refresh-btn").disabled = false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  if (!response) throw new Error("Ollama: empty response from background.");
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Ollama 403 (CORS): restart Ollama with:\n" +
        "1) taskkill /IM ollama.exe /F\n" +
        "2) $env:OLLAMA_ORIGINS='*'\n" +
        "3) ollama serve"
      );
    }
    if (response.status === 0) {
      throw new Error(`Ollama: Failed to connect — ${response.error || "unknown network error"}`);
    }
    throw new Error(
      response?.data?.error?.message || response?.data?.message || `Ollama ${response.status}`
    );
  }
  return response.data || {};
}

async function fetchJsonWithError(url, options, label) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (e) {
    throw new Error(`${label}: Failed to fetch — ${e.message}`);
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error?.message || json?.message || `${label} ${response.status}`);
  }
  return json;
}

function showError(box, msg) { box.textContent = msg; box.classList.add("visible"); }
function hideError(box)      { box.classList.remove("visible"); }
function setLoading(btn, on) { btn.disabled = on; btn.classList.toggle("spinning", on); }

// ── Structured summary renderer ───────────────────────────────────────────────
/**
 * Parses a raw summary paragraph into bullet points.
 * Tries to split on sentence boundaries and returns up to ~5 points.
 */
function parseSummaryToPoints(rawText) {
  if (!rawText) return [];
  // Split on sentence endings, numbered lists, or explicit bullet markers
  let sentences = rawText
    .split(/(?<=[.!?])\s+|(?:\n+)|(?:\d+[.)]\s+)/)
    .map(s => s.replace(/^[-•*]\s*/, "").trim())
    .filter(s => s.length > 20);

  // Keep at most 6 points; merge short ones
  while (sentences.length > 6) {
    let shortest = sentences.reduce((minI, s, i, arr) => s.length < arr[minI].length ? i : minI, 0);
    const merged = shortest > 0
      ? [sentences[shortest - 1] + " " + sentences[shortest], ...sentences.slice(0, shortest - 1), ...sentences.slice(shortest + 1)]
      : [sentences[0] + " " + sentences[1], ...sentences.slice(2)];
    sentences = merged;
  }
  return sentences.slice(0, 6);
}

function renderStructuredSummary(container, rawText, pageTitle, pageUrl, model) {
  const points = parseSummaryToPoints(rawText);

  let badgeClass = "badge-cloud";
  if (model === "ollama")   badgeClass = "badge-ollama";
  else if (model === "bart") badgeClass = "badge-bart";
  else if (model === "t5")   badgeClass = "badge-t5";
  else if (model === "lexrank") badgeClass = "badge-lexrank";
  else if (model === "combined") badgeClass = "badge-bart";

  const headerHtml = pageTitle
    ? `<div class="summary-header-row">
        <div>
          <div class="summary-page-title">${escHtml(pageTitle)}</div>
          ${pageUrl ? `<div class="summary-meta">${escHtml(pageUrl)}</div>` : ""}
        </div>
        <span class="model-badge ${badgeClass}" style="flex-shrink:0">${escHtml(model)}</span>
       </div>`
    : "";

  const pointsHtml = points.length
    ? `<div class="key-points-label">Key Points</div>
       <ul class="key-points-list">
         ${points.map((p, i) => `<li><span class="point-bullet">${i + 1}</span><span>${escHtml(p)}</span></li>`).join("")}
       </ul>`
    : "";

  const fullHtml = `
    <button class="full-para-toggle" id="full-para-toggle">▶ Show full summary</button>
    <div class="full-para" id="full-para-text">${escHtml(rawText)}</div>
  `;

  container.innerHTML = headerHtml + pointsHtml + fullHtml;

  // Hook toggle
  const toggle = container.querySelector("#full-para-toggle");
  const fullPara = container.querySelector("#full-para-text");
  if (toggle && fullPara) {
    toggle.addEventListener("click", () => {
      fullPara.classList.toggle("open");
      toggle.textContent = fullPara.classList.contains("open")
        ? "▼ Hide full summary"
        : "▶ Show full summary";
    });
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayResults(data, isCloud, pageTitle, pageUrl, modelName) {
  resultBox.classList.add("visible");

  const finalText = isCloud
    ? (data.summary || "")
    : (data.final_summary || data.summary || "");

  renderStructuredSummary(
    $("structured-body"),
    finalText,
    pageTitle || state.pageTitle,
    pageUrl   || state.pageUrl,
    modelName || "model"
  );

  // Breakdown sections (local combined only)
  const showBreakdown = !isCloud && data.bart_summary;
  ["bart","t5","lexrank"].forEach(m => {
    $(`section-${m}`).style.display = showBreakdown ? "block" : "none";
  });
  if (showBreakdown) {
    $("body-bart").textContent    = data.bart_summary       || "";
    $("body-t5").textContent      = data.t5_summary         || "";
    $("body-lexrank").textContent = data.extractive_summary || "";
  }

  // Store for download
  state.lastSummaryData = {
    title: pageTitle || state.pageTitle,
    url:   pageUrl   || state.pageUrl,
    model: modelName,
    summary: finalText,
    bart:    data.bart_summary || "",
    t5:      data.t5_summary   || "",
    lexrank: data.extractive_summary || "",
    date:    new Date().toISOString(),
  };

  // Save to history (JSON DB)
  saveToHistory(state.lastSummaryData);
}

// ── Local model ───────────────────────────────────────────────────────────────
async function callLocalModel(text, model) {
  if (model === "combined") {
    const form = new FormData();
    form.append("text", text);
    let r;
    try {
      r = await fetch(`${state.serverUrl}/summarize`, { method:"POST", body:form });
    } catch (_) {
      state.serverOnline = false;
      serverDot.className = "status-dot";
      serverText.textContent = "Local server offline";
      throw new Error("Local server went offline during summarization.\nRestart with:\n  uvicorn main:app --port 5001");
    }
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`Model error (${r.status}): ${body.slice(0, 300) || "Server returned an error."}`);
    }
    return r.json();
  }
  let r;
  try {
    r = await fetch(`${state.serverUrl}/summarize/selective`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ text, model }),
    });
  } catch (_) {
    state.serverOnline = false;
    serverDot.className = "status-dot";
    serverText.textContent = "Local server offline";
    throw new Error("Local server went offline during summarization.\nRestart with:\n  uvicorn main:app --port 5001");
  }
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Model error (${r.status}): ${body.slice(0, 300) || "Server returned an error."}`);
  }
  return r.json();
}

// ── Cloud API calls ───────────────────────────────────────────────────────────
const PROMPT = (text) =>
  `Summarize the following text clearly and concisely. Break it into 4-6 key points if possible, then provide a brief paragraph summary. Return only the summary content:\n\n${text.slice(0, 12000)}`;

async function callOpenAI(text, key) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
    body: JSON.stringify({
      model:"gpt-4o", max_tokens:600,
      messages:[
        { role:"system", content:"You are a concise summarization assistant. Format key insights as numbered points followed by a summary paragraph." },
        { role:"user", content:PROMPT(text) },
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
      const summary = data?.candidates?.[0]?.content?.parts?.map(p => p.text||"").join("\n").trim();
      if (!summary) throw new Error(`Gemini returned empty for ${model}.`);
      return { summary, model_used: model };
    } catch (error) {
      lastError = error;
      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("unsupported")) continue;
      throw error;
    }
  }
  throw lastError || new Error("No supported Gemini model found.");
}

async function callAnthropic(text, key) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-api-key":key, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({
      model:"claude-3-5-haiku-20241022", max_tokens:600,
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
    body: JSON.stringify({ model:"llama3.2", prompt:PROMPT(text), stream:false }),
  });
  if (!data?.response) {
    throw new Error("Ollama: No response. Run `ollama pull llama3.2`.");
  }
  return { summary: data.response, model_used: "llama3.2" };
}

async function callMistral(text, key) {
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
    body: JSON.stringify({
      model:"mistral-small-latest", max_tokens:600,
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
      model:"llama3-8b-8192", max_tokens:600,
      messages:[
        { role:"system", content:"Summarize clearly with numbered key points followed by a brief summary paragraph." },
        { role:"user", content:PROMPT(text) },
      ],
    }),
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||`Groq ${r.status}`); }
  const d = await r.json();
  return { summary: d.choices[0].message.content };
}

const CLOUD_CALLERS = {
  openai:callOpenAI, gemini:callGemini, anthropic:callAnthropic,
  mistral:callMistral, groq:callGroq, ollama:callOllama
};

async function callCloud(provider, text) {
  if (provider === "ollama") return callOllama(text);
  const key = state.keys[provider];
  if (!key) throw new Error(`No ${provider} API key saved. Go to Settings ⚙ to add it.`);
  const fn = CLOUD_CALLERS[provider];
  if (!fn) throw new Error(`Unknown provider: ${provider}`);
  return fn(text, key);
}

// ── Summarize page ────────────────────────────────────────────────────────────
summarizeBtn.addEventListener("click", async () => {
  hideError(errorBox);
  resultBox.classList.remove("visible");

  if (!state.pageText) {
    showError(errorBox, "No page content found. Try clicking ↺ to refresh.");
    return;
  }

  const { provider, model } = parseModelSelect($("model-select").value);
  setLoading(summarizeBtn, true);
  lockForSummarization();

  // Use the locked text (snapshot at click time)
  const textToSummarize = state.lockedPageText;
  const titleForDisplay = state.lockedPageTitle;
  const urlForDisplay   = state.lockedPageUrl;

  try {
    let data;
    if (provider === "local") {
      if (!state.serverOnline) {
        const online = await checkServer(true);
        if (!online) throw new Error(
          "Local server is offline.\nRun in summary_service folder:\n\n  uvicorn main:app --port 5001"
        );
      }
      data = await callLocalModel(textToSummarize, model);
      displayResults(data, false, titleForDisplay, urlForDisplay, model);
    } else {
      data = await callCloud(model, textToSummarize);
      displayResults(data, true, titleForDisplay, urlForDisplay, model);
    }
  } catch (err) {
    showError(errorBox, err.message || String(err));
  } finally {
    setLoading(summarizeBtn, false);
    unlockAfterSummarization();
  }
});

// ── Copy structured summary ───────────────────────────────────────────────────
$("copy-structured-btn").addEventListener("click", () => {
  if (!state.lastSummaryData) return;
  const text = buildPlainText(state.lastSummaryData);
  navigator.clipboard.writeText(text).then(() => {
    $("copy-structured-btn").textContent = "✓ copied";
    setTimeout(() => $("copy-structured-btn").textContent = "copy text", 1500);
  });
});

// ── Download helpers ──────────────────────────────────────────────────────────
function buildPlainText(data) {
  let out = "";
  if (data.title) out += `Title: ${data.title}\n`;
  if (data.url)   out += `URL: ${data.url}\n`;
  if (data.date)  out += `Date: ${data.date}\n`;
  if (data.model) out += `Model: ${data.model}\n`;
  out += "\n";
  out += "=== SUMMARY ===\n\n";
  out += data.summary + "\n";
  if (data.bart) out += "\n--- BART ---\n" + data.bart + "\n";
  if (data.t5)   out += "\n--- T5 ---\n"   + data.t5   + "\n";
  if (data.lexrank) out += "\n--- LexRank ---\n" + data.lexrank + "\n";
  return out;
}

function downloadTxt(data) {
  const text = buildPlainText(data);
  const blob = new Blob([text], { type: "text/plain" });
  triggerDownload(blob, `summary-${Date.now()}.txt`);
}

function downloadPdf(data) {
  // Build a simple HTML page and print-to-PDF using a data URI
  const safeTitle   = escHtml(data.title || "Summary");
  const safeUrl     = escHtml(data.url   || "");
  const safeSummary = escHtml(data.summary || "");
  const points      = parseSummaryToPoints(data.summary || "");

  const pointsHtml = points.map((p, i) =>
    `<li style="margin-bottom:8px"><strong>${i+1}.</strong> ${escHtml(p)}</li>`
  ).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${safeTitle}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#1a2535;line-height:1.6}
  h1{font-size:20px;margin-bottom:4px}
  .meta{font-size:12px;color:#667;margin-bottom:24px}
  h2{font-size:14px;color:#3a7fc1;margin:20px 0 8px}
  ul{padding-left:0;list-style:none}
  li{padding:6px 0;border-bottom:1px solid #eee}
  .full-para{font-size:13px;color:#334;margin-top:16px}
</style></head><body>
<h1>${safeTitle}</h1>
<div class="meta">${safeUrl}<br>Generated: ${new Date().toLocaleString()}</div>
<h2>Key Points</h2>
<ul>${pointsHtml}</ul>
<h2>Full Summary</h2>
<p class="full-para">${safeSummary}</p>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  triggerDownload(blob, `summary-${Date.now()}.html`);

  // Also open in new tab so user can Ctrl+P → Save as PDF
  const url = URL.createObjectURL(blob);
  chrome.tabs.create({ url });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

$("download-txt-btn").addEventListener("click", () => {
  if (state.lastSummaryData) downloadTxt(state.lastSummaryData);
});
$("download-pdf-btn").addEventListener("click", () => {
  if (state.lastSummaryData) downloadPdf(state.lastSummaryData);
});

// ── Upload panel ──────────────────────────────────────────────────────────────
const dropZone     = $("drop-zone");
const fileInput    = $("file-input");
const filePreview  = $("file-preview");
const uploadBtn    = $("upload-summarize-btn");
const uploadError  = $("upload-error-box");
const uploadResult = $("upload-result-container");

dropZone.addEventListener("click",    () => fileInput.click());
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave",  () => dropZone.classList.remove("drag-over"));
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
  uploadBtn.disabled = true;
  uploadResult.classList.remove("visible");
});

uploadBtn.addEventListener("click", async () => {
  if (!state.selectedFile) return;
  hideError(uploadError);
  uploadResult.classList.remove("visible");
  setLoading(uploadBtn, true);

  const { provider, model } = parseModelSelect($("upload-model-select").value);

  try {
    let summary = "";
    let fileName = state.selectedFile.name;

    if (provider === "local") {
      if (!state.serverOnline) {
        const online = await checkServer();
        if (!online) throw new Error("Local server offline. Run: uvicorn main:app --port 5001");
      }
      const form = new FormData();
      form.append("file", state.selectedFile, state.selectedFile.name);
      form.append("model", model);
      const r = await fetch(`${state.serverUrl}/summarize`, { method:"POST", body:form });
      if (!r.ok) throw new Error(`Server error ${r.status}: ${await r.text()}`);
      const d = await r.json();
      summary = d.final_summary || d.summary || "";
    } else {
      const text = await readFileAsText(state.selectedFile);
      if (!text.trim()) throw new Error("No text could be extracted from this file.");
      const d = await callCloud(model, text);
      summary = d.summary;
    }

    // Render structured summary for upload
    renderStructuredSummary($("upload-structured-body"), summary, fileName, "", model);
    uploadResult.classList.add("visible");

    state.uploadLastData = {
      title: fileName, url: "", model, summary, date: new Date().toISOString()
    };

    saveToHistory(state.uploadLastData);

  } catch (err) {
    showError(uploadError, err.message || String(err));
  } finally {
    setLoading(uploadBtn, false);
  }
});

$("copy-upload-btn").addEventListener("click", () => {
  if (!state.uploadLastData) return;
  navigator.clipboard.writeText(buildPlainText(state.uploadLastData)).then(() => {
    $("copy-upload-btn").textContent = "✓ copied";
    setTimeout(() => $("copy-upload-btn").textContent = "copy", 1500);
  });
});

$("upload-download-txt-btn").addEventListener("click", () => {
  if (state.uploadLastData) downloadTxt(state.uploadLastData);
});
$("upload-download-pdf-btn").addEventListener("click", () => {
  if (state.uploadLastData) downloadPdf(state.uploadLastData);
});

/**
 * Read file as plain text.
 * .txt  → FileReader
 * .pdf  → PDF.js via CDN
 */
async function readFileAsText(file) {
  const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
  if (!isPdf) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = e => res(e.target.result);
      reader.onerror = () => rej(new Error("Could not read file"));
      reader.readAsText(file, "utf-8");
    });
  }

  if (!window.pdfjsLib) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = res;
      s.onerror = () => rej(new Error("Could not load PDF.js. Check internet connection."));
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

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
      "This PDF appears to be image-only — no text layer found.\n" +
      "Try a local model (uses pypdf on the server)."
    );
  }
  return pageTexts.join("\n\n");
}

// ── JSON DB / History ─────────────────────────────────────────────────────────
async function loadHistory() {
  const data = await chrome.storage.local.get(["summaryHistory"]);
  return Array.isArray(data.summaryHistory) ? data.summaryHistory : [];
}

async function saveToHistory(entry) {
  const history = await loadHistory();
  // Add to front, keep last 50
  history.unshift({ ...entry, id: Date.now() });
  const trimmed = history.slice(0, 50);
  await chrome.storage.local.set({ summaryHistory: trimmed });
  renderHistory(trimmed);
}

function renderHistory(items) {
  const list = $("history-list");
  if (!items || items.length === 0) {
    list.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:20px 0">No history yet</div>`;
    return;
  }
  list.innerHTML = items.map(item => {
    const date = item.date ? new Date(item.date).toLocaleString() : "";
    return `<div class="history-item" data-id="${item.id}">
      <div class="history-item-title">${escHtml(item.title || "Untitled")}</div>
      <div class="history-item-meta">${escHtml(item.model || "")} · ${escHtml(date)}</div>
    </div>`;
  }).join("");

  // Click to restore a history entry
  list.querySelectorAll(".history-item").forEach(el => {
    el.addEventListener("click", () => {
      const id = Number(el.dataset.id);
      const entry = items.find(i => i.id === id);
      if (!entry) return;
      state.lastSummaryData = entry;
      renderStructuredSummary(
        $("structured-body"), entry.summary, entry.title, entry.url, entry.model
      );
      resultBox.classList.add("visible");
      // Switch to summarize tab
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      document.querySelector('[data-tab="summarize"]').classList.add("active");
      $("panel-summarize").classList.add("active");
    });
  });
}

$("clear-history-btn").addEventListener("click", async () => {
  if (!confirm("Clear all summary history?")) return;
  await chrome.storage.local.remove("summaryHistory");
  renderHistory([]);
});

// ── Settings ──────────────────────────────────────────────────────────────────
document.querySelectorAll(".key-save-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const provider = btn.dataset.key;
    const val = $(`key-${provider}`).value.trim();
    if (!val || val === "••••••••••••") return;
    state.keys[provider] = val;
    await chrome.storage.local.set({ keys: state.keys });
    $(`key-${provider}`).value = "••••••••••••";
    const badge = $(`badge-${provider}`);
    if (badge) badge.classList.add("visible");
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

$("test-ollama-btn").addEventListener("click", async () => {
  const url = $("ollama-url-input").value.trim();
  state.ollamaUrl = url;
  await chrome.storage.local.set({ ollamaUrl: url });
  try {
    const baseUrl = state.ollamaUrl.replace(/\/$/, "");
    const data = await fetchOllamaViaBackground(`${baseUrl}/api/tags`, { method:"GET" });
    const hasLlama = Array.isArray(data?.models) &&
      data.models.some(m => m?.name?.startsWith("llama3.2"));
    alert(hasLlama
      ? "✓ Ollama reachable and llama3.2 installed."
      : "Ollama reachable, but llama3.2 not found. Run: ollama pull llama3.2"
    );
  } catch (err) {
    alert(err?.message || String(err));
  }
});

$("clear-keys-btn").addEventListener("click", async () => {
  if (!confirm("Clear all saved API keys?")) return;
  state.keys = Object.fromEntries(ALL_PROVIDERS.map(p => [p,""]));
  await chrome.storage.local.remove("keys");
  ALL_PROVIDERS.forEach(k => {
    const el = $(`key-${k}`);
    if (el) el.value = "";
    const badge = $(`badge-${k}`);
    if (badge) badge.classList.remove("visible");
  });
});

$("refresh-btn").addEventListener("click", () => {
  if (!state.isSummarizing) grabPageContent();
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await loadSettings();
  const history = await loadHistory();
  renderHistory(history);
  await Promise.all([checkServer(), grabPageContent()]);
  setInterval(checkServer, 30_000);
  // Auto-refresh page content every 3 seconds when not summarizing
  setInterval(() => { if (!state.isSummarizing) grabPageContent(); }, 3000);
})();
