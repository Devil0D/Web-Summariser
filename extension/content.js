// content.js
// Injected into every page. Extracts readable text and sends it to the sidebar.

function extractPageText() {
  // Remove noise: nav, footer, ads, scripts, styles
  const NOISE_TAGS = ["script","style","nav","footer","header","aside","noscript","iframe"];
  const clone = document.body.cloneNode(true);

  NOISE_TAGS.forEach(tag => {
    clone.querySelectorAll(tag).forEach(el => el.remove());
  });

  // Prefer <article> / <main> / [role=main] if available
  const article = clone.querySelector("article, main, [role='main']");
  const root    = article || clone;

  const raw = root.innerText || root.textContent || "";

  // Collapse whitespace
  return raw.replace(/\s+/g, " ").trim();
}

function publishPageContent() {
  chrome.runtime.sendMessage({
    type:  "PAGE_CONTENT",
    title: document.title,
    url:   window.location.href,
    text:  extractPageText(),
  });
}

let publishTimer = null;
function publishPageContentDebounced(delay = 200) {
  clearTimeout(publishTimer);
  publishTimer = setTimeout(() => {
    publishPageContent();
  }, delay);
}

// Send page info to the sidebar whenever the sidebar asks for it
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PAGE_CONTENT") {
    sendResponse({
      type:  "PAGE_CONTENT",
      title: document.title,
      url:   window.location.href,
      text:  extractPageText(),
    });
  }
  return true;
});

// Also push content automatically on page load (sidebar may already be open)
window.addEventListener("load", () => publishPageContentDebounced(100));
window.addEventListener("pageshow", () => publishPageContentDebounced(100));
window.addEventListener("hashchange", () => publishPageContentDebounced(150));
window.addEventListener("popstate", () => publishPageContentDebounced(150));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    publishPageContentDebounced(100);
  }
});

// SPA navigations often use history API without full page reload.
const _pushState = history.pushState;
history.pushState = function () {
  const ret = _pushState.apply(this, arguments);
  publishPageContentDebounced(150);
  return ret;
};

const _replaceState = history.replaceState;
history.replaceState = function () {
  const ret = _replaceState.apply(this, arguments);
  publishPageContentDebounced(150);
  return ret;
};
