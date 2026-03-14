<<<<<<< HEAD
// sidebar.js  –  Websears v2.1
// Fixes: Gemini model name (gemini-1.5-flash → gemini-2.0-flash-exp with fallback)
// New: formatted summaries, noise filter, voice TTS, export .txt / .md, key validation
=======
// sidebar.js
>>>>>>> 65459a273944037978469feb854b5e7588d50575

const ALL_PROVIDERS = ["openai","gemini","anthropic","mistral","groq","cohere"];

const state = {
<<<<<<< HEAD
  pageText:     "",
  pageTitle:    "",
  pageUrl:      "",
  serverUrl:    "http://localhost:5001",
  serverOnline: false,
  selectedFile: null,
  keys:         Object.fromEntries(ALL_PROVIDERS.map(p => [p, ""])),
  // last raw summaries for view toggle
  rawSummary:   "",
  formattedHTML: "",
  rawUploadSummary: "",
  formattedUploadHTML: "",
  viewMode:     "formatted",   // "formatted" | "plain"
  speechUtterance: null,
  speaking:     false,
  speakingUpload: false,
=======
  pageText:    "",
  pageTitle:   "",
  pageUrl:     "",
  serverUrl:   "http://localhost:5001",
  serverOnline: false,
  selectedFile: null,
  keys: Object.fromEntries(ALL_PROVIDERS.map(p => [p, ""])),
>>>>>>> 65459a273944037978469feb854b5e7588d50575
};

const $ = id => document.getElementById(id);

<<<<<<< HEAD
// ── NOISE CLEANING ────────────────────────────────────────────────────────────
// Removes common output corruption: garbled unicode, repeated chars, soft hyphens,
// control chars, and truncated/repeated token artifacts (versiuneversiune etc.)
function cleanNoise(text) {
  if (!text) return "";
  return text
    // Remove soft hyphens and zero-width chars
    .replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, "")
    // Remove runs of non-word characters that look like noise (e.g. ---­­_­)
    .replace(/[-_\s\.]{4,}/g, " … ")
    // Remove repeated-word artifacts like "versiuneversiuneversiune"
    .replace(/(\b\w{4,}\b)\1{2,}/gi, "$1")
    // Remove leftover bracket/symbol noise sequences
    .replace(/[[\](){}\*#&$@%!~`|\\^]{3,}/g, "")
    // Collapse excessive whitespace / newlines
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{3,}/g, " ")
    // Trim
    .trim();
}

// ── SUMMARY FORMATTER ─────────────────────────────────────────────────────────
// Converts a flat summary string into bullet-point HTML for easier reading.
function formatSummaryHTML(rawText) {
  const cleaned = cleanNoise(rawText);
  if (!cleaned) return "<em style='color:var(--text-muted)'>No summary available.</em>";

  // Split into sentences
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // skip very short fragments

  if (sentences.length <= 1) {
    // Just return as a paragraph if single sentence
    return `<p style="font-size:12px;line-height:1.75;color:var(--text)">${cleaned}</p>`;
  }

  // First sentence → intro
  const intro = sentences[0];
  const rest   = sentences.slice(1);

  let html = `<div class="sum-intro">${intro}</div>`;
  if (rest.length > 0) {
    html += `<ul class="sum-points">`;
    rest.forEach(s => {
      html += `<li>${s}</li>`;
    });
    html += `</ul>`;
  }
  return html;
}

// ── TABS ──────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
=======
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
>>>>>>> 65459a273944037978469feb854b5e7588d50575
    tab.classList.add("active");
    $(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

$("settings-shortcut").addEventListener("click", () => {
<<<<<<< HEAD
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
=======
  tabs.forEach(t => t.classList.remove("active"));
  panels.forEach(p => p.classList.remove("active"));
>>>>>>> 65459a273944037978469feb854b5e7588d50575
  document.querySelector('[data-tab="settings"]').classList.add("active");
  $("panel-settings").classList.add("active");
});

<<<<<<< HEAD
// ── SETTINGS LOAD ─────────────────────────────────────────────────────────────
=======
// ── settings load ─────────────────────────────────────────────────────────────
>>>>>>> 65459a273944037978469feb854b5e7588d50575
async function loadSettings() {
  const data = await chrome.storage.local.get(["serverUrl","keys"]);
  if (data.serverUrl) {
    state.serverUrl = data.serverUrl;
    $("server-url-input").value = data.serverUrl;
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

<<<<<<< HEAD
// ── SERVER HEALTH ──────────────────────────────────────────────────────────────
async function checkServer() {
  $("server-dot").className = "status-dot checking";
  $("server-status-text").textContent = "Checking local server…";
  try {
    const r = await fetch(`${state.serverUrl}/health`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      $("server-dot").className = "status-dot ok";
      $("server-status-text").textContent = "Local server online";
=======
// ── server health ─────────────────────────────────────────────────────────────
async function checkServer() {
  serverDot.className = "status-dot checking";
  serverText.textContent = "Checking local server…";
  try {
    const r = await fetch(`${state.serverUrl}/health`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      serverDot.className = "status-dot ok";
      serverText.textContent = "Local server online";
>>>>>>> 65459a273944037978469feb854b5e7588d50575
      state.serverOnline = true;
      return true;
    }
  } catch (_) {}
<<<<<<< HEAD
  $("server-dot").className = "status-dot";
  $("server-status-text").textContent = "Local server offline";
=======
  serverDot.className = "status-dot";
  serverText.textContent = "Local server offline";
>>>>>>> 65459a273944037978469feb854b5e7588d50575
  state.serverOnline = false;
  return false;
}

<<<<<<< HEAD
// ── PAGE CONTENT ───────────────────────────────────────────────────────────────
=======
// ── page content ──────────────────────────────────────────────────────────────
>>>>>>> 65459a273944037978469feb854b5e7588d50575
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

<<<<<<< HEAD
// ── HELPERS ───────────────────────────────────────────────────────────────────
=======
// ── helpers ───────────────────────────────────────────────────────────────────
>>>>>>> 65459a273944037978469feb854b5e7588d50575
function parseModelSelect(value) {
  const [provider, model] = value.split(":");
  return { provider, model };
}
function showError(box, msg) { box.textContent = msg; box.classList.add("visible"); }
<<<<<<< HEAD
function hideError(box)      { box.classList.remove("visible"); }
function setLoading(btn, on) { btn.disabled = on; btn.classList.toggle("spinning", on); }

function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

// ── VIEW TOGGLE ───────────────────────────────────────────────────────────────
$("view-formatted").addEventListener("click", () => {
  state.viewMode = "formatted";
  $("view-formatted").classList.add("active");
  $("view-plain").classList.remove("active");
  $("text-final").innerHTML = state.formattedHTML;
});

$("view-plain").addEventListener("click", () => {
  state.viewMode = "plain";
  $("view-plain").classList.add("active");
  $("view-formatted").classList.remove("active");
  $("text-final").textContent = state.rawSummary;
});

// ── BREAKDOWN COLLAPSIBLE ─────────────────────────────────────────────────────
$("breakdown-toggle").addEventListener("click", () => {
  const header = $("breakdown-toggle");
  const body   = $("breakdown-body");
  header.classList.toggle("open");
  body.classList.toggle("open");
});

// ── DISPLAY RESULTS ───────────────────────────────────────────────────────────
function displayResults(data, isCloud = false) {
  $("result-container").classList.add("visible");

  const raw = isCloud
    ? (data.summary || "")
    : (data.final_summary || data.summary || "");

  const cleaned = cleanNoise(raw);
  state.rawSummary    = cleaned;
  state.formattedHTML = formatSummaryHTML(cleaned);

  // Render based on current view mode
  if (state.viewMode === "formatted") {
    $("text-final").innerHTML   = state.formattedHTML;
    $("view-formatted").classList.add("active");
    $("view-plain").classList.remove("active");
  } else {
    $("text-final").textContent = state.rawSummary;
    $("view-plain").classList.add("active");
    $("view-formatted").classList.remove("active");
  }

  // Show breakdown section only for local combined
  const hasBreakdown = !isCloud && data.bart_summary;
  $("section-breakdown").style.display = hasBreakdown ? "block" : "none";

  if (hasBreakdown) {
    $("text-bart").textContent    = cleanNoise(data.bart_summary        || "");
    $("text-t5").textContent      = cleanNoise(data.t5_summary          || "");
    $("text-lexrank").textContent = cleanNoise(data.extractive_summary  || "");
  }
}

function displayUploadResult(summary) {
  const cleaned = cleanNoise(summary);
  state.rawUploadSummary      = cleaned;
  state.formattedUploadHTML   = formatSummaryHTML(cleaned);
  $("upload-text-final").innerHTML = state.formattedUploadHTML;
  $("upload-result-container").style.display = "flex";
}

// ── LOCAL MODEL ───────────────────────────────────────────────────────────────
=======
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
>>>>>>> 65459a273944037978469feb854b5e7588d50575
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

<<<<<<< HEAD
// ── CLOUD API CALLS ───────────────────────────────────────────────────────────
const PROMPT = (text) =>
  `Please summarize the following web page content. Write a concise, informative summary. Return ONLY the summary text with no preamble, headers, or meta-commentary:\n\n${text.slice(0, 12000)}`;
=======
// ── cloud API calls ───────────────────────────────────────────────────────────
const PROMPT = (text) =>
  `Summarize the following text concisely. Return only the summary, no preamble:\n\n${text.slice(0, 12000)}`;
>>>>>>> 65459a273944037978469feb854b5e7588d50575

async function callOpenAI(text, key) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
    body: JSON.stringify({
<<<<<<< HEAD
      model:"gpt-4o-mini", max_tokens:600,
      messages:[
        { role:"system", content:"You are a helpful summarization assistant. Return only the summary, no preamble." },
=======
      model:"gpt-4o", max_tokens:500,
      messages:[
        { role:"system", content:"You are a concise summarization assistant." },
>>>>>>> 65459a273944037978469feb854b5e7588d50575
        { role:"user",   content:PROMPT(text) },
      ],
    }),
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||`OpenAI ${r.status}`); }
  const d = await r.json();
  return { summary: d.choices[0].message.content };
}

<<<<<<< HEAD
// FIXED: use gemini-2.0-flash as primary, fall back to gemini-1.5-flash-latest
async function callGemini(text, key) {
  const models = [
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-pro"
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ contents:[{ parts:[{ text: PROMPT(text) }] }] })
        }
      );

      if (r.status === 404) {
        // Model not found, try next
        lastError = new Error(`Model ${model} not found`);
        continue;
      }

      if (!r.ok) {
        const e = await r.json().catch(()=>({}));
        const msg = e?.error?.message || `Gemini ${r.status}`;
        // If it's the model-not-found error, try next
        if (msg.includes("not found") || msg.includes("not supported") || r.status === 404) {
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }

      const d = await r.json();
      const text_out = d?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text_out) throw new Error("Gemini returned empty response");
      return { summary: text_out };

    } catch (err) {
      if (err.message.includes("not found") || err.message.includes("not supported") || err.message.includes("Model")) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("No working Gemini model found. Check your API key at aistudio.google.com");
=======
async function callGemini(text, key) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ contents:[{ parts:[{ text: PROMPT(text) }] }] }) }
  );
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||`Gemini ${r.status}`); }
  const d = await r.json();
  return { summary: d.candidates[0].content.parts[0].text };
>>>>>>> 65459a273944037978469feb854b5e7588d50575
}

async function callAnthropic(text, key) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-api-key":key, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({
<<<<<<< HEAD
      model:"claude-haiku-4-5-20251001", max_tokens:600,
=======
      model:"claude-3-5-haiku-20241022", max_tokens:500,
>>>>>>> 65459a273944037978469feb854b5e7588d50575
      messages:[{ role:"user", content:PROMPT(text) }],
    }),
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||`Anthropic ${r.status}`); }
  const d = await r.json();
  return { summary: d.content[0].text };
}

async function callMistral(text, key) {
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
    body: JSON.stringify({
<<<<<<< HEAD
      model:"mistral-small-latest", max_tokens:600,
=======
      model:"mistral-small-latest", max_tokens:500,
>>>>>>> 65459a273944037978469feb854b5e7588d50575
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
<<<<<<< HEAD
      model:"llama3-8b-8192", max_tokens:600,
      messages:[
        { role:"system", content:"You are a concise summarization assistant. Return only the summary, no preamble." },
=======
      model:"llama3-8b-8192", max_tokens:500,
      messages:[
        { role:"system", content:"You are a concise summarization assistant." },
>>>>>>> 65459a273944037978469feb854b5e7588d50575
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
<<<<<<< HEAD
      model:"command-r", max_tokens:600,
=======
      model:"command-r", max_tokens:500,
>>>>>>> 65459a273944037978469feb854b5e7588d50575
      messages:[{ role:"user", content:PROMPT(text) }],
    }),
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e?.message||`Cohere ${r.status}`); }
  const d = await r.json();
  return { summary: d.message?.content?.[0]?.text || d.text || "" };
}

const CLOUD_CALLERS = { openai:callOpenAI, gemini:callGemini, anthropic:callAnthropic,
                        mistral:callMistral, groq:callGroq, cohere:callCohere };

async function callCloud(provider, text) {
  const key = state.keys[provider];
<<<<<<< HEAD
  if (!key) throw new Error(`No ${provider} API key saved. Go to Settings to add it.`);
=======
  if (!key) throw new Error(`No ${provider} API key saved. Go to Settings ⚙ to add it.`);
>>>>>>> 65459a273944037978469feb854b5e7588d50575
  const fn = CLOUD_CALLERS[provider];
  if (!fn) throw new Error(`Unknown provider: ${provider}`);
  return fn(text, key);
}

<<<<<<< HEAD
// ── SUMMARIZE PAGE ────────────────────────────────────────────────────────────
$("summarize-btn").addEventListener("click", async () => {
  hideError($("error-box"));
  $("result-container").classList.remove("visible");
  stopSpeech();

  if (!state.pageText) {
    showError($("error-box"), "No page content found. Try clicking ↺ to refresh.");
=======
// ── summarize page ────────────────────────────────────────────────────────────
summarizeBtn.addEventListener("click", async () => {
  hideError(errorBox);
  resultBox.classList.remove("visible");

  if (!state.pageText) {
    showError(errorBox, "No page content found. Try clicking ↺ to refresh.");
>>>>>>> 65459a273944037978469feb854b5e7588d50575
    return;
  }

  const { provider, model } = parseModelSelect($("model-select").value);
<<<<<<< HEAD
  setLoading($("summarize-btn"), true);
=======
  setLoading(summarizeBtn, true);
>>>>>>> 65459a273944037978469feb854b5e7588d50575

  try {
    let data;
    if (provider === "local") {
      if (!state.serverOnline) {
        const online = await checkServer();
        if (!online) throw new Error(
<<<<<<< HEAD
          "Local server is offline.\nRun this in your project folder:\n\n  uvicorn main:app --port 5001"
=======
          "Local server is offline.\nRun this in your summary_service folder:\n\n  uvicorn main:app --port 5001"
>>>>>>> 65459a273944037978469feb854b5e7588d50575
        );
      }
      data = await callLocalModel(state.pageText, model);
      displayResults(data, false);
    } else {
      data = await callCloud(model, state.pageText);
      displayResults(data, true);
    }
  } catch (err) {
<<<<<<< HEAD
    showError($("error-box"), err.message || String(err));
  } finally {
    setLoading($("summarize-btn"), false);
  }
});

// ── UPLOAD PANEL ──────────────────────────────────────────────────────────────
const dropZone    = $("drop-zone");
const fileInput   = $("file-input");
const filePreview = $("file-preview");
const uploadBtn   = $("upload-summarize-btn");
const uploadError = $("upload-error-box");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
=======
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
>>>>>>> 65459a273944037978469feb854b5e7588d50575
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
<<<<<<< HEAD
  uploadBtn.disabled = true;
  $("upload-result-container").style.display = "none";
=======
  uploadBtn.disabled = true; uploadResult.style.display = "none";
>>>>>>> 65459a273944037978469feb854b5e7588d50575
});

uploadBtn.addEventListener("click", async () => {
  if (!state.selectedFile) return;
<<<<<<< HEAD
  hideError(uploadError);
  $("upload-result-container").style.display = "none";
  stopSpeechUpload();
=======
  hideError(uploadError); uploadResult.style.display = "none";
>>>>>>> 65459a273944037978469feb854b5e7588d50575
  setLoading(uploadBtn, true);

  const { provider, model } = parseModelSelect($("upload-model-select").value);

  try {
    let summary = "";
    if (provider === "local") {
      if (!state.serverOnline) {
        const online = await checkServer();
        if (!online) throw new Error("Local server offline. Run: uvicorn main:app --port 5001");
      }
      const form = new FormData();
      form.append("file", state.selectedFile, state.selectedFile.name);
      form.append("model", model);
      const r = await fetch(`${state.serverUrl}/summarize`, { method:"POST", body:form });
<<<<<<< HEAD
      if (!r.ok) throw new Error(`Server error ${r.status}: ${await r.text()}`);
=======
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`Server error ${r.status}: ${body}`);
      }
>>>>>>> 65459a273944037978469feb854b5e7588d50575
      const d = await r.json();
      summary = d.final_summary || d.summary || "";
    } else {
      if (state.selectedFile.name.endsWith(".pdf")) {
        throw new Error(
<<<<<<< HEAD
          "PDF uploads to cloud APIs need the local server to extract text.\n" +
          "Either use a Local Model, or convert your PDF to .txt first."
=======
          "PDF uploads to cloud APIs require the local server to extract text.\n" +
          "Either: use a Local Model, or convert your PDF to .txt first."
>>>>>>> 65459a273944037978469feb854b5e7588d50575
        );
      }
      const text = await readFileAsText(state.selectedFile);
      const d = await callCloud(model, text);
      summary = d.summary;
    }
<<<<<<< HEAD
    displayUploadResult(summary);
=======
    $("upload-text-final").textContent = summary;
    uploadResult.style.display = "flex";
>>>>>>> 65459a273944037978469feb854b5e7588d50575
  } catch (err) {
    showError(uploadError, err.message || String(err));
  } finally {
    setLoading(uploadBtn, false);
  }
});

function readFileAsText(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = e => res(e.target.result);
    reader.onerror = () => rej(new Error("Could not read file"));
    reader.readAsText(file, "utf-8");
  });
}

<<<<<<< HEAD
// ── VOICE / TTS ───────────────────────────────────────────────────────────────
function stopSpeech() {
  if (speechSynthesis.speaking) speechSynthesis.cancel();
  state.speaking = false;
  updateSpeakBtn(false, "btn-speak", "speak-label", "speak-ico", "voice-wave");
}

function stopSpeechUpload() {
  if (speechSynthesis.speaking) speechSynthesis.cancel();
  state.speakingUpload = false;
  updateSpeakBtn(false, "btn-speak-upload", "speak-label-upload", "speak-ico-upload", "voice-wave-upload");
}

function updateSpeakBtn(speaking, btnId, labelId, icoId, waveId) {
  const btn = $(btnId);
  const wave = $(waveId);
  if (speaking) {
    btn.classList.add("speaking");
    $(labelId).textContent = "Stop";
    wave.classList.add("active");
  } else {
    btn.classList.remove("speaking");
    $(labelId).textContent = "Read aloud";
    wave.classList.remove("active");
  }
}

$("btn-speak").addEventListener("click", () => {
  if (state.speaking) {
    stopSpeech();
    return;
  }
  const text = state.rawSummary;
  if (!text) return;
  stopSpeechUpload();

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate  = 0.95;
  utter.pitch = 1;
  utter.lang  = "en-US";
  utter.onend = () => {
    state.speaking = false;
    updateSpeakBtn(false, "btn-speak", "speak-label", "speak-ico", "voice-wave");
  };
  utter.onerror = () => {
    state.speaking = false;
    updateSpeakBtn(false, "btn-speak", "speak-label", "speak-ico", "voice-wave");
  };

  state.speaking = true;
  updateSpeakBtn(true, "btn-speak", "speak-label", "speak-ico", "voice-wave");
  speechSynthesis.speak(utter);
});

$("btn-speak-upload").addEventListener("click", () => {
  if (state.speakingUpload) {
    stopSpeechUpload();
    return;
  }
  const text = state.rawUploadSummary;
  if (!text) return;
  stopSpeech();

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate  = 0.95;
  utter.pitch = 1;
  utter.lang  = "en-US";
  utter.onend = () => {
    state.speakingUpload = false;
    updateSpeakBtn(false, "btn-speak-upload", "speak-label-upload", "speak-ico-upload", "voice-wave-upload");
  };
  utter.onerror = () => {
    state.speakingUpload = false;
    updateSpeakBtn(false, "btn-speak-upload", "speak-label-upload", "speak-ico-upload", "voice-wave-upload");
  };

  state.speakingUpload = true;
  updateSpeakBtn(true, "btn-speak-upload", "speak-label-upload", "speak-ico-upload", "voice-wave-upload");
  speechSynthesis.speak(utter);
});

// ── COPY BUTTONS ───────────────────────────────────────────────────────────────
$("btn-copy-final").addEventListener("click", () => {
  const txt = state.rawSummary;
  if (!txt) return;
  navigator.clipboard.writeText(txt).then(() => showToast("Copied to clipboard!"));
});

$("btn-copy-upload").addEventListener("click", () => {
  const txt = state.rawUploadSummary;
  if (!txt) return;
  navigator.clipboard.writeText(txt).then(() => showToast("Copied to clipboard!"));
});

// ── EXPORT FUNCTIONS ──────────────────────────────────────────────────────────
function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildMarkdown(title, url, summary) {
  const date = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  // Split into sentences for bullet list
  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15);

  let md = `# Summary\n\n`;
  if (title) md += `**Page:** ${title}\n`;
  if (url)   md += `**URL:** ${url}\n`;
  md += `**Date:** ${date}\n\n---\n\n`;

  if (sentences.length > 1) {
    md += `${sentences[0]}\n\n`;
    sentences.slice(1).forEach(s => { md += `- ${s}\n`; });
  } else {
    md += summary;
  }

  return md;
}

$("btn-export-txt").addEventListener("click", () => {
  if (!state.rawSummary) return;
  const filename = (state.pageTitle || "summary").replace(/[^a-z0-9]/gi,"_").slice(0,40) + ".txt";
  downloadText(filename, `Summary of: ${state.pageTitle}\nURL: ${state.pageUrl}\nDate: ${new Date().toLocaleDateString()}\n\n${state.rawSummary}`);
  showToast("Saved as .txt!");
});

$("btn-export-md").addEventListener("click", () => {
  if (!state.rawSummary) return;
  const filename = (state.pageTitle || "summary").replace(/[^a-z0-9]/gi,"_").slice(0,40) + ".md";
  downloadText(filename, buildMarkdown(state.pageTitle, state.pageUrl, state.rawSummary));
  showToast("Saved as .md!");
});

$("btn-export-upload-txt").addEventListener("click", () => {
  if (!state.rawUploadSummary) return;
  const filename = (state.selectedFile?.name || "summary").replace(/\.[^.]+$/, "") + "_summary.txt";
  downloadText(filename, `Summary\nFile: ${state.selectedFile?.name || ""}\nDate: ${new Date().toLocaleDateString()}\n\n${state.rawUploadSummary}`);
  showToast("Saved as .txt!");
});

$("btn-export-upload-md").addEventListener("click", () => {
  if (!state.rawUploadSummary) return;
  const name = (state.selectedFile?.name || "summary").replace(/\.[^.]+$/, "");
  downloadText(name + "_summary.md", buildMarkdown(name, "", state.rawUploadSummary));
  showToast("Saved as .md!");
});

// ── API KEY SAVE & VALIDATE ────────────────────────────────────────────────────
=======
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
>>>>>>> 65459a273944037978469feb854b5e7588d50575
document.querySelectorAll(".key-save-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const provider = btn.dataset.key;
    const val = $(`key-${provider}`).value.trim();
    if (!val || val === "••••••••••••") return;
<<<<<<< HEAD

=======
>>>>>>> 65459a273944037978469feb854b5e7588d50575
    state.keys[provider] = val;
    await chrome.storage.local.set({ keys: state.keys });
    $(`key-${provider}`).value = "••••••••••••";
    $(`badge-${provider}`).classList.add("visible");
    enableCloudOption(provider);
    btn.textContent = "✓";
    setTimeout(() => btn.textContent = "Save", 1500);
<<<<<<< HEAD

    // Validate key
    await validateKey(provider, val);
  });
});

async function validateKey(provider, key) {
  const statusEl = $(`status-${provider}`);
  if (!statusEl) return;

  statusEl.className = "key-status testing";
  statusEl.textContent = "Testing key…";

  try {
    // Quick test call per provider
    let valid = false;

    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${key}` },
        signal: AbortSignal.timeout(8000)
      });
      valid = r.ok;
    }
    else if (provider === "gemini") {
      // List models to check key validity
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        { signal: AbortSignal.timeout(8000) }
      );
      valid = r.ok;
    }
    else if (provider === "anthropic") {
      // Anthropic doesn't have a cheap test endpoint; try a tiny message
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-api-key":key, "anthropic-version":"2023-06-01" },
        body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:5, messages:[{ role:"user", content:"hi" }] }),
        signal: AbortSignal.timeout(10000)
      });
      valid = r.ok;
    }
    else if (provider === "mistral") {
      const r = await fetch("https://api.mistral.ai/v1/models", {
        headers: { "Authorization": `Bearer ${key}` },
        signal: AbortSignal.timeout(8000)
      });
      valid = r.ok;
    }
    else if (provider === "groq") {
      const r = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${key}` },
        signal: AbortSignal.timeout(8000)
      });
      valid = r.ok;
    }
    else if (provider === "cohere") {
      const r = await fetch("https://api.cohere.com/v2/models", {
        headers: { "Authorization": `Bearer ${key}` },
        signal: AbortSignal.timeout(8000)
      });
      valid = r.ok;
    }

    if (valid) {
      statusEl.className = "key-status ok";
      statusEl.textContent = "✓ Key works!";
    } else {
      statusEl.className = "key-status fail";
      statusEl.textContent = "✗ Key invalid or quota exceeded";
    }
  } catch (e) {
    statusEl.className = "key-status fail";
    statusEl.textContent = "✗ Could not verify key (network error)";
  }

  setTimeout(() => {
    statusEl.className = "key-status";
    statusEl.textContent = "";
  }, 6000);
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
=======
  });
});

>>>>>>> 65459a273944037978469feb854b5e7588d50575
$("test-server-btn").addEventListener("click", async () => {
  const url = $("server-url-input").value.trim();
  state.serverUrl = url;
  await chrome.storage.local.set({ serverUrl: url });
  await checkServer();
});

$("clear-keys-btn").addEventListener("click", async () => {
  if (!confirm("Clear all saved API keys?")) return;
  state.keys = Object.fromEntries(ALL_PROVIDERS.map(p => [p, ""]));
  await chrome.storage.local.remove("keys");
  ALL_PROVIDERS.forEach(k => {
    $(`key-${k}`).value = "";
    $(`badge-${k}`).classList.remove("visible");
  });
<<<<<<< HEAD
  showToast("All keys cleared");
=======
>>>>>>> 65459a273944037978469feb854b5e7588d50575
});

$("refresh-btn").addEventListener("click", grabPageContent);

<<<<<<< HEAD
// ── INIT ───────────────────────────────────────────────────────────────────────
=======
// ── init ──────────────────────────────────────────────────────────────────────
>>>>>>> 65459a273944037978469feb854b5e7588d50575
(async () => {
  await loadSettings();
  await Promise.all([checkServer(), grabPageContent()]);
  setInterval(checkServer, 30_000);
<<<<<<< HEAD
})();
=======
})();
>>>>>>> 65459a273944037978469feb854b5e7588d50575
