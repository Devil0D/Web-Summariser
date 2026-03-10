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
window.addEventListener("load", () => {
  chrome.runtime.sendMessage({
    type:  "PAGE_CONTENT",
    title: document.title,
    url:   window.location.href,
    text:  extractPageText(),
  });
});
