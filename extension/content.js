// content.js
// Injected into every page. Extracts readable text and sends it to the sidebar.

function extractPageText() {
  // Remove noise: nav, footer, ads, scripts, styles
  const NOISE_TAGS = ["script","style","nav","footer","header","aside","noscript","iframe","meta","link"];
  const clone = document.documentElement.cloneNode(true);

  NOISE_TAGS.forEach(tag => {
    clone.querySelectorAll(tag).forEach(el => el.remove());
  });

  // Try to find main content area
  let mainContent = null;
  
  // Priority: article > main > [role=main] > [role=article] > body
  mainContent = clone.querySelector("article") ||
                clone.querySelector("main") ||
                clone.querySelector("[role='main']") ||
                clone.querySelector("[role='article']") ||
                clone.querySelector(".content") ||
                clone.querySelector(".post") ||
                clone.querySelector(".entry-content");
  
  if (!mainContent) {
    mainContent = clone.body;
  }

  // Get all text content and clean it up
  let text = mainContent.innerText || mainContent.textContent || "";
  
  // Remove extra whitespace but preserve some structure
  text = text
    .replace(/\n\n\n+/g, "\n\n")  // Multiple newlines → double newline
    .replace(/[ \t]+/g, " ")       // Multiple spaces → single space
    .trim();

  return text;
}

function publishPageContent() {
  const text = extractPageText();
  
  // Only send if we have meaningful content
  if (text && text.length > 50) {
    chrome.runtime.sendMessage({
      type:  "PAGE_CONTENT",
      title: document.title,
      url:   window.location.href,
      text:  text,
    }).catch(err => console.log("Message send failed (sidebar might be closed):", err));
  }
}

let publishTimer = null;
function publishPageContentDebounced(delay = 500) {
  clearTimeout(publishTimer);
  publishTimer = setTimeout(() => {
    publishPageContent();
  }, delay);
}

// Send page info to the sidebar whenever the sidebar asks for it
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PAGE_CONTENT") {
    const text = extractPageText();
    console.log(`[content.js] GET_PAGE_CONTENT: extracted ${text.length} chars`);
    sendResponse({
      type:  "PAGE_CONTENT",
      title: document.title,
      url:   window.location.href,
      text:  text,
    });
  }
  return true;
});

// Immediately publish content when script initializes
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => publishPageContent());
} else {
  publishPageContent();
}

// Also push content automatically on page load (sidebar may already be open)
window.addEventListener("load", () => publishPageContentDebounced(200));
window.addEventListener("DOMContentLoaded", () => publishPageContentDebounced(100));
window.addEventListener("pageshow", () => publishPageContentDebounced(300));
window.addEventListener("hashchange", () => publishPageContentDebounced(500));
window.addEventListener("popstate", () => publishPageContentDebounced(500));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    publishPageContentDebounced(200);
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
