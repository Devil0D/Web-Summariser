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
  manualLinks: [],           // for manual link input
  queryMode: false,          // for query interaction
  historyCategory: "all",    // filter history: "all", "link", "file", "text"
  fileSourceType: "file",    // track if file came from paste or upload: "file", "image"
  detectedLlamaModel: null,  // Detected Llama model (llama3.2, llama3, etc.)
  lastLlamaDetectionTime: 0, // Prevent excessive detection calls
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

// History category tabs: filter by source type (All, Link, File, Text, Image) (Phase 3)
document.querySelectorAll(".history-tab").forEach(btn => {
  btn.addEventListener("click", async () => {
    const category = btn.dataset.category;
    state.historyCategory = category;
    
    // Update active tab styling
    document.querySelectorAll(".history-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    // Load and filter history
    const history = await loadHistory();
    const filtered = category === "all" 
      ? history 
      : history.filter(h => (h.sourceType || "link") === category);
    renderHistory(filtered);
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

// ── Manual Link Input ─────────────────────────────────────────────────────────
$("link-toggle-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  const dropdown = $("manual-link-dropdown");
  dropdown.classList.toggle("hidden");
  if (!dropdown.classList.contains("hidden")) {
    $("manual-link-input").focus();
  }
});

$("link-add-btn").addEventListener("click", () => {
  const url = $("manual-link-input").value.trim();
  if (!url) return;
  
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    alert("Invalid URL. Make sure it starts with http:// or https://");
    return;
  }
  
  // Avoid duplicates
  if (state.manualLinks.includes(url)) {
    alert("This link is already added.");
    return;
  }
  
  state.manualLinks.push(url);
  $("manual-link-input").value = "";
  renderAddedLinks();
});

$("link-clear-btn").addEventListener("click", () => {
  state.manualLinks = [];
  $("manual-link-input").value = "";
  renderAddedLinks();
  $("manual-link-dropdown").classList.add("hidden");
});

function renderAddedLinks() {
  const list = $("added-links-list");
  if (!state.manualLinks || state.manualLinks.length === 0) {
    list.innerHTML = "";
    return;
  }
  
  list.innerHTML = state.manualLinks.map((url, i) => `
    <div class="added-link-item">
      <span class="added-link-item-text" title="${url}">${url}</span>
      <button class="added-link-remove-btn" data-index="${i}">✕</button>
    </div>
  `).join("");
  
  // Remove button handlers
  list.querySelectorAll(".added-link-remove-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      state.manualLinks.splice(idx, 1);
      renderAddedLinks();
    });
  });
}

// Allow Enter key in manual link input
$("manual-link-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") $("link-add-btn").click();
});

// ── Query/Follow-up Section ────────────────────────────────────────────────────
function showQuerySection() {
  $("query-section").classList.remove("hidden");
  state.queryMode = true;
  $("query-input").focus();
}

function hideQuerySection() {
  $("query-section").classList.add("hidden");
  $("query-response").classList.add("hidden");
  state.queryMode = false;
}

// Allow external code to show query section (after summarization)
window.enableQueryMode = showQuerySection;

$("query-close-btn").addEventListener("click", hideQuerySection);

$("query-send-btn").addEventListener("click", async () => {
  const query = $("query-input").value.trim();
  if (!query || !state.lastSummaryData) return;
  
  setLoading($("query-send-btn"), true);
  const responseBox = $("query-response");
  responseBox.classList.add("hidden");
  
  try {
    // Store the current query context
    const context = {
      query,
      originalSummary: state.lastSummaryData.summary,
      pageTitle: state.lastSummaryData.title,
      model: state.lastSummaryData.model,
    };
    
    const { provider, model } = parseModelSelect($("model-select").value);
    const prompt = `Based on the following summary:\n\n"${state.lastSummaryData.summary}"\n\nPlease answer this question: ${query}`;
    
    let response;
    if (provider === "local") {
      if (!state.serverOnline) {
        const online = await checkServer(true);
        if (!online) throw new Error("Local server offline.");
      }
      const r = await fetch(`${state.serverUrl}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `text=${encodeURIComponent(prompt)}&model=${model}`,
      });
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      const d = await r.json();
      response = d.summary || d.final_summary;
    } else {
      const d = await callCloud(model, prompt);
      response = d.summary;
    }
    
    if (!response) throw new Error("No response from model");
    
    // Display response
    responseBox.textContent = response;
    responseBox.classList.remove("hidden");
    responseBox.classList.add("visible");
    
    // Store for context
    state.lastQueryResponse = response;
    
  } catch (err) {
    responseBox.textContent = `Error: ${err.message}`;
    responseBox.classList.remove("hidden");
    responseBox.classList.add("visible");
  } finally {
    setLoading($("query-send-btn"), false);
  }
});

// Allow Enter key in query input
$("query-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") $("query-send-btn").click();
});

// ── Theme toggle and select ─────────────────────────────────────────────────────
const THEME_CYCLE = ["dark", "light", "wood", "cherry", "night-blue", "shady-dark"];
const THEME_ICONS = {
  dark: "🌙",
  light: "☀",
  wood: "🌳",
  cherry: "🍒",
  "night-blue": "🌌",
  "shady-dark": "🫐"
};

$("theme-toggle").addEventListener("click", async () => {
  const currentIndex = THEME_CYCLE.indexOf(state.theme);
  const nextIndex = (currentIndex + 1) % THEME_CYCLE.length;
  state.theme = THEME_CYCLE[nextIndex];
  applyTheme(state.theme);
  if ($("theme-select")) $("theme-select").value = state.theme;
  await chrome.storage.local.set({ theme: state.theme });
});

// Theme dropdown selector
if ($("theme-select")) {
  $("theme-select").addEventListener("change", async (e) => {
    state.theme = e.target.value;
    applyTheme(state.theme);
    await chrome.storage.local.set({ theme: state.theme });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  $("theme-toggle").textContent = THEME_ICONS[theme] || "🌙";
  if ($("theme-select")) $("theme-select").value = theme;
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
  } else {
    // Default to dark theme on first load
    state.theme = "dark";
    applyTheme("dark");
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
      
      // Auto-detect Llama model when server comes online (with built-in 30-second cache)
      detectLlamaModel().catch(err => console.warn("Could not pre-detect Llama model:", err.message));
      
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

// ── Llama Model Detection ──────────────────────────────────────────────────────

async function detectLlamaModel() {
  /**
   * Detect which Llama model is installed & running.
   * Returns: "llama3.2", "llama3", or null
   * Uses caching to prevent excessive requests (cache valid for 30 seconds)
   */
  const now = Date.now();
  const CACHE_DURATION = 30000; // 30 seconds
  
  // Return cached result if still valid
  if (state.detectedLlamaModel && (now - state.lastLlamaDetectionTime) < CACHE_DURATION) {
    return state.detectedLlamaModel;
  }
  
  try {
    // Try to detect from backend
    const response = await fetch(`${state.serverUrl}/llama/detect`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data?.status === "connected" && data?.recommended) {
        state.detectedLlamaModel = data.recommended;
        state.lastLlamaDetectionTime = now;
        console.log(`✓ Detected Llama model: ${data.recommended}`);
        return data.recommended;
      }
    }
  } catch (err) {
    console.warn("Llama detection failed, will use fallback:", err.message);
  }
  
  // Fallback: return null, and let callOllama use default
  state.detectedLlamaModel = null;
  return null;
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

  // Check if summary is empty
  if (!finalText || !finalText.trim()) {
    showError(errorBox, "The model returned an empty summary. This might happen if:\n• The input text is too short\n• The input is mostly noise\n• The server encountered an error\n\nTry a longer text or switch models.");
    resultBox.classList.remove("visible");
    return;
  }

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
  
  // Enable query mode for follow-ups
  showQuerySection();
}

// ── Local model ───────────────────────────────────────────────────────────────
async function callLocalModel(text, model) {
  const TIMEOUT_MS = 120000; // 2 minutes for slow models like T5
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    if (model === "combined") {
      const form = new FormData();
      form.append("text", text);
      let r;
      try {
        r = await fetch(`${state.serverUrl}/summarize`, { 
          method: "POST", 
          body: form,
          signal: controller.signal 
        });
      } catch (err) {
        if (err.name === "AbortError") {
          throw new Error(`Summarization timeout (${TIMEOUT_MS/1000}s). Text may be too long.\nTry shorter text or single model instead of combined.`);
        }
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
    
    // Single model mode
    let r;
    try {
      r = await fetch(`${state.serverUrl}/summarize/selective`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, model }),
        signal: controller.signal
      });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error(`Summarization timeout (${TIMEOUT_MS/1000}s). Text may be too long.\nTry ${model === "t5" ? "BART" : "a lighter model"} instead.`);
      }
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
  } finally {
    clearTimeout(timeoutId);
  }
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
  // Detect which model to use (llama3.2, llama3, etc.)
  const detectedModel = await detectLlamaModel();
  const model = detectedModel || "llama3.2"; // Fallback to llama3.2 if detection fails
  
  const baseUrl = state.ollamaUrl.replace(/\/$/, "");
  const data = await fetchOllamaViaBackground(`${baseUrl}/api/generate`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ model: model, prompt:PROMPT(text), stream:false }),
  });
  if (!data?.response) {
    throw new Error(`Ollama (${model}): No response. Run 'ollama pull ${model}'.`);
  }
  return { summary: data.response, model_used: model };
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

  if (!state.pageText && !state.manualLinks.length) {
    showError(errorBox, "No content to summarize. Grab page content or add manual links.");
    return;
  }

  const { provider, model } = parseModelSelect($("model-select").value);
  setLoading(summarizeBtn, true);
  lockForSummarization();

  // Use the locked text (snapshot at click time)
  let textToSummarize = state.lockedPageText;
  const titleForDisplay = state.lockedPageTitle;
  const urlForDisplay   = state.lockedPageUrl;

  try {
    // Fetch content from manual links if any
    if (state.manualLinks && state.manualLinks.length > 0) {
      hideError(errorBox);
      const manualContent = await fetchManualLinksContent(state.manualLinks);
      if (manualContent) {
        // Combine current page text with manual links content
        textToSummarize = textToSummarize 
          ? `${textToSummarize}\n\n---\n\n${manualContent}`
          : manualContent;
      }
    }

    if (!textToSummarize || !textToSummarize.trim()) {
      showError(errorBox, "No text could be extracted from the page or provided links.");
      return;
    }

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

// Fetch content from manual links
async function fetchManualLinksContent(urls) {
  if (!urls || urls.length === 0) return "";
  
  const results = [];
  for (const url of urls) {
    try {
      showError(errorBox, `Fetching content from ${url}…`);
      const response = await backgroundMessage({ 
        type: "FETCH_URL_TEXT", 
        url 
      });
      
      if (response?.ok && response?.text) {
        results.push(`[From: ${url}]\n${response.text}`);
      } else {
        console.warn(`Failed to fetch ${url}:`, response?.error);
      }
    } catch (err) {
      console.warn(`Error fetching ${url}:`, err.message);
    }
  }
  
  return results.join("\n\n---\n\n");
}

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

/**
 * Validate and set selected file for upload.
 * Supports: PDF, DOCX, TXT, JPG, PNG, GIF, BMP, WebP (Phase 3 Backend)
 * Images can be processed via client-side OCR or server-side OCR
 */
function setFile(file) {
  // Phase 3: Extended format support including BMP and WebP
  const supportedTypes = /\.(txt|pdf|docx|jpg|jpeg|png|gif|bmp|webp)$/i;
  if (!supportedTypes.test(file.name)) {
    showError(uploadError, [
      "Unsupported file format: " + file.name,
      "",
      "Supported formats:",
      "• Documents: PDF, DOCX, TXT",
      "• Images: JPG, PNG, GIF, BMP, WebP (OCR enabled)"
    ].join("\n")); 
    return;
  }
  
  // Detect if this is an image file (Phase 3)
  const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp)$/i;
  if (imageExtensions.test(file.name)) {
    state.fileSourceType = "image";
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

// ── Manual Text Input ─────────────────────────────────────────────────────────
// Allow users to paste or type text directly for summarization (Phase 3 feature)
$("manual-text-summarize-btn").addEventListener("click", async () => {
  const text = $("manual-text-input").value.trim();
  if (!text) {
    showError(uploadError, "Please paste or type some text to summarize.");
    return;
  }

  hideError(uploadError);
  uploadResult.classList.remove("visible");
  setLoading($("manual-text-summarize-btn"), true);

  const { provider, model } = parseModelSelect($("upload-model-select").value);

  try {
    let summary = "";

    if (provider === "local") {
      if (!state.serverOnline) {
        const online = await checkServer();
        if (!online) throw new Error("Local server offline.");
      }
      const d = await callLocalModel(text, model);
      summary = d.final_summary || d.summary || "";
    } else {
      const d = await callCloud(model, text);
      summary = d.summary;
    }

    if (!summary || !summary.trim()) {
      throw new Error("Model returned empty summary. Try shorter text or different model.");
    }

    // Render structured summary for upload
    renderStructuredSummary($("upload-structured-body"), summary, "Text Input", "", model);
    uploadResult.classList.add("visible");

    state.uploadLastData = {
      title: "Text Input", url: "", model, summary, sourceType: "text", 
      date: new Date().toISOString()
    };

    saveToHistory(state.uploadLastData);

  } catch (err) {
    showError(uploadError, err.message || String(err));
  } finally {
    setLoading($("manual-text-summarize-btn"), false);
  }
});

// ── Image Paste Support ────────────────────────────────────────────────────────
// Allow users to paste images directly (Ctrl+V) for OCR and summarization (Phase 3)
document.addEventListener("paste", async (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith("image/")) {
      e.preventDefault();
      const blob = item.getAsFile();
      if (blob) {
        // Check if we're on the upload tab
        if ($("panel-upload").classList.contains("active")) {
          state.fileSourceType = "image"; // Mark as pasted image
          setFile(blob);
          uploadBtn.click();
        }
      }
    }
  }
});

// ── Upload with multi-format support ──────────────────────────────────────────
// Phase 3: Supports PDF, DOCX, TXT, and Images (with OCR) via flexible backend
uploadBtn.addEventListener("click", async () => {
  if (!state.selectedFile) return;
  hideError(uploadError);
  uploadResult.classList.remove("visible");
  setLoading(uploadBtn, true);

  const { provider, model } = parseModelSelect($("upload-model-select").value);
  const fileName = state.selectedFile.name;

  try {
    let summary = "";

    if (provider === "local") {
      // Local models: Send file directly to backend for processing
      if (!state.serverOnline) {
        const online = await checkServer();
        if (!online) throw new Error("Local server offline. Run: uvicorn main:app --port 5001");
      }
      
      const form = new FormData();
      form.append("file", state.selectedFile, state.selectedFile.name);
      form.append("model", model);
      
      const r = await fetch(`${state.serverUrl}/summarize`, { method:"POST", body:form });
      
      // Parse response and extract error details
      let responseText = "";
      try {
        responseText = await r.text();
      } catch (e) { /* ignore */ }
      
      if (!r.ok) {
        // Backend provides detailed error messages (Phase 3)
        throw new Error(responseText.slice(0, 500) || `Server error ${r.status}`);
      }
      
      try {
        const d = JSON.parse(responseText);
        summary = d.final_summary || d.summary || "";
      } catch (e) {
        throw new Error("Invalid response from server: " + e.message);
      }
    } else {
      // Cloud models: Extract text on client before sending
      // For images: client-side OCR via Tesseract.js
      const text = await readFileAsText(state.selectedFile);
      
      // Special handling for OCR results
      if (text.includes("No readable text found")) {
        showError(uploadError, text);
        return;
      }
      
      if (!text.trim()) {
        throw new Error("No text could be extracted from this file.");
      }
      
      const d = await callCloud(model, text);
      summary = d.summary;
    }

    if (!summary || !summary.trim()) {
      throw new Error("Model returned empty summary. Try a different file or model.");
    }

    // Render structured summary for upload
    renderStructuredSummary($("upload-structured-body"), summary, fileName, "", model);
    uploadResult.classList.add("visible");

    state.uploadLastData = {
      title: fileName, url: "", model, summary, 
      sourceType: state.fileSourceType || "file",
      date: new Date().toISOString()
    };

    state.fileSourceType = "file"; // Reset for next upload
    saveToHistory(state.uploadLastData);

  } catch (err) {
    // Display detailed error message from backend or frontend
    const errorMsg = err.message || String(err);
    showError(uploadError, errorMsg);
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
 * Read file as plain text - supports multiple formats (Phase 3 extended)
 * 
 * Format support:
 * .txt   → FileReader (direct text reading)
 * .pdf   → PDF.js via CDN (client-side), fallback to server extraction
 * .docx  → Server-side extraction via FormData (not extracted client-side)
 * .jpg/.png/.gif/.bmp/.webp → Tesseract.js OCR (client-side text extraction)
 * 
 * Used by cloud models to extract text before sending to API.
 * Local models send original file to backend for server-side extraction.
 * 
 * Returns: extracted text string or error message
 * Throws: HTTPException with detailed error message
 */
async function readFileAsText(file) {
  const isImage = /\.(jpg|jpeg|png|gif)$/i.test(file.name) || file.type.startsWith("image/");
  const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
  
  if (isImage) {
    // Images: Try OCR extraction
    console.log("Detected image file, attempting OCR...");
    try {
      return await extractImageTextOcr(file);
    } catch (err) {
      console.warn("OCR extraction failed:", err.message);
      throw new Error([
        "Could not extract text from image.",
        "Reasons: OCR unavailable, image too complex, or no visible text.",
        "",
        "Try:",
        "• Ensure the image contains clear, readable text",
        "• Use cloud models which may have better image support"
      ].join("\n"));
    }
  }
  
  if (!isPdf) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = e => res(e.target.result);
      reader.onerror = () => rej(new Error("Could not read file"));
      reader.readAsText(file, "utf-8");
    });
  }

  // PDF handling: Try PDF.js, then fall back to server extraction
  let pdfText = null;
  
  // Try client-side PDF.js extraction first
  if (window.pdfjsLib) {
    try {
      pdfText = await extractPdfClientSide(file);
      if (pdfText) return pdfText;
    } catch (err) {
      console.warn("Client-side PDF extraction failed:", err.message);
    }
  }
  
  // Try loading PDF.js from CDN (only if we have internet)
  try {
    await loadPdfJs();
    pdfText = await extractPdfClientSide(file);
    if (pdfText) return pdfText;
  } catch (err) {
    console.warn("PDF.js not available (no internet or offline):", err.message);
  }
  
  // Fallback: Use server-side PDF extraction
  console.log("Using server-side PDF extraction...");
  try {
    return await extractPdfServerSide(file);
  } catch (err) {
    throw new Error(
      "PDF extraction failed both client-side and server-side.\n" +
      "Error: " + err.message + "\n" +
      "Make sure local server is running on " + state.serverUrl
    );
  }
}

/**
 * Image OCR extraction using Tesseract.js (Phase 3)
 * Extracts text from images (JPG, PNG, GIF) using client-side OCR
 * Loads Tesseract.js from CDN on first use
 * Used by cloud models when processing image files
 */
async function extractImageTextOcr(file) {
  // Load Tesseract.js if not already loaded
  if (!window.Tesseract) {
    console.log("Loading Tesseract.js for OCR...");
    await new Promise((res, rej) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = res;
      script.onerror = () => rej(new Error("Failed to load Tesseract.js"));
      document.head.appendChild(script);
    });
  }

  const buffer = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = () => rej(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });

  try {
    const result = await window.Tesseract.recognize(buffer, "eng");
    const text = result.data.text.trim();
    if (!text) {
      throw new Error("No text detected in image");
    }
    return text;
  } catch (err) {
    throw new Error("OCR failed: " + (err.message || String(err)));
  }
}


// Load PDF.js from CDN
async function loadPdfJs() {
  if (window.pdfjsLib) return; // Already loaded
  
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        res();
      } catch (e) {
        rej(e);
      }
    };
    s.onerror = () => rej(new Error("Could not load PDF.js from CDN. Check internet connection."));
    s.timeout = 10000;
    document.head.appendChild(s);
  });
}

// Client-side PDF extraction using PDF.js
async function extractPdfClientSide(file) {
  if (!window.pdfjsLib) {
    throw new Error("PDF.js not loaded");
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
    throw new Error("No text found in PDF");
  }
  
  return pageTexts.join("\n");
}

// Server-side PDF extraction fallback
async function extractPdfServerSide(file) {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(`${state.serverUrl}/upload/pdf/extract`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(120000) // 2 min timeout
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText.slice(0, 200) || `Server error: ${response.status}`);
  }

  const result = await response.json();
  
  // Return extracted text
  if (result.text && result.text.trim()) {
    return result.text;
  }
  
  throw new Error("Server returned no text from PDF");
}

// ── JSON DB / History ─────────────────────────────────────────────────────────
async function loadHistory() {
  const data = await chrome.storage.local.get(["summaryHistory"]);
  return Array.isArray(data.summaryHistory) ? data.summaryHistory : [];
}

async function saveToHistory(entry) {
  const history = await loadHistory();
  // Ensure sourceType is set (default to "link" for backward compatibility)
  if (!entry.sourceType) {
    if (entry.url && entry.url.trim()) {
      entry.sourceType = "link";
    } else {
      entry.sourceType = "file"; // fallback
    }
  }
  // Add to front, keep last 50
  history.unshift({ ...entry, id: Date.now() });
  const trimmed = history.slice(0, 50);
  await chrome.storage.local.set({ summaryHistory: trimmed });
  // Re-render with current filter
  const filtered = state.historyCategory === "all" 
    ? trimmed 
    : trimmed.filter(h => (h.sourceType || "link") === state.historyCategory);
  renderHistory(filtered);
}

function renderHistory(items) {
  const list = $("history-list");
  if (!items || items.length === 0) {
    list.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:20px 0">No history yet</div>`;
    return;
  }
  list.innerHTML = items.map(item => {
    const date = item.date ? new Date(item.date).toLocaleString() : "";
    const sourceType = item.sourceType || "link";
    const sourceLabel = {
      "link": "🔗 Link",
      "file": "📄 File",
      "text": "✎ Text",
      "image": "🖼️ Image"
    }[sourceType] || "Link";
    return `<div class="history-item" data-id="${item.id}" data-source="${sourceType}">
      <div class="history-item-title">${escHtml(item.title || "Untitled")}</div>
      <div class="history-item-meta">${sourceLabel} · ${escHtml(item.model || "")} · ${escHtml(date)}</div>
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
    // Try the new Llama detection endpoint first
    try {
      const detectionResponse = await fetch(`${state.serverUrl}/llama/detect`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      if (detectionResponse.ok) {
        const detectionData = await detectionResponse.json();
        if (detectionData?.status === "connected" && detectionData?.available?.length > 0) {
          const models = detectionData.available.join(", ");
          const recommended = detectionData.recommended;
          state.detectedLlamaModel = recommended;
          state.lastLlamaDetectionTime = Date.now();
          alert(`✓ Ollama reachable\n\nAvailable models: ${models}\nRecommended: ${recommended}`);
          return;
        }
      }
    } catch (detectionErr) {
      console.log("Detection endpoint not available, falling back to direct check:", detectionErr.message);
    }
    
    // Fallback: Direct Ollama check (original behavior)
    const baseUrl = url.replace(/\/$/, "");
    const data = await fetchOllamaViaBackground(`${baseUrl}/api/tags`, { method:"GET" });
    const hasLlama = Array.isArray(data?.models) && data.models.length > 0;
    const modelsList = data?.models?.map(m => m?.name)?.join(", ") || "unknown";
    
    if (hasLlama) {
      alert(`✓ Ollama reachable\n\nInstalled models:\n${modelsList}`);
    } else {
      alert("Ollama reachable, but no models found.\n\nInstall a model:\n• ollama pull llama3.2\n• ollama pull llama3");
    }
  } catch (err) {
    alert(`❌ Error: ${err?.message || String(err)}`);
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

$("refresh-btn").addEventListener("click", async () => {
  if (!state.isSummarizing) {
    await grabPageContent();
    // Also refresh manual links if any exist
    if (state.manualLinks && state.manualLinks.length > 0) {
      try {
        await fetchManualLinksContent(state.manualLinks);
        hideError(errorBox); // Clear errors on successful refresh
      } catch (err) {
        // Silently fail, as manual links are optional
        console.warn("Manual links refresh failed:", err.message);
      }
    }
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await loadSettings();
  
  // Mark "all" history tab as active initially
  document.querySelectorAll(".history-tab").forEach(btn => {
    if (btn.dataset.category === "all") {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  
  const history = await loadHistory();
  renderHistory(history);
  await Promise.all([checkServer(), grabPageContent()]);
  
  // Periodic health checks: reduced to 5 minutes (300,000 ms) instead of 30 seconds
  // This prevents excessive /health and /llama/detect polling
  setInterval(checkServer, 300_000);
  
  // Page content refresh: reduced from 3 seconds to 10 seconds, only when not summarizing
  // This prevents excessive polling of page content
  setInterval(() => { if (!state.isSummarizing) grabPageContent(); }, 10_000);
})();
