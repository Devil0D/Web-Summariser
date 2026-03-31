// background.js
// Opens the side panel when the extension icon is clicked

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

const pageContentCache = new Map();

// Inject content.js into all existing tabs on startup
// This fixes the issue where tabs opened before the extension was loaded can't grab content
async function injectContentScriptIntoExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      // Skip protected/special pages
      if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("about:") || tab.url.startsWith("extension://")) {
        continue;
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
        console.log(`[Startup] Injected content.js into tab ${tab.id}: ${tab.title}`);
      } catch (err) {
        console.debug(`[Startup] Could not inject into tab ${tab.id}:`, err.message);
      }
    }
  } catch (err) {
    console.warn("[Startup] Error during content script injection:", err.message);
  }
}

// Run injection on service worker startup
injectContentScriptIntoExistingTabs();

async function requestPageContentWithRetry(tabId, retries = 8) {
  // Quick check: is this a page where content scripts can't run?
  try {
    const tabInfo = await chrome.tabs.get(tabId);
    if (tabInfo?.url?.startsWith("chrome://") || tabInfo?.url?.startsWith("about:")) {
      console.warn(`[Content grab] Tab is protected: ${tabInfo.url}`);
      return null;
    }
  } catch (err) {
    console.warn(`[Content grab] Could not check tab info:`, err.message);
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_CONTENT" });
      if (response?.text && response.text.length > 50) {
        pageContentCache.set(tabId, response);
        chrome.runtime.sendMessage(response).catch(() => {});
        console.log(`[Content grab] Success on attempt ${attempt + 1}`);
        return response;
      }
    } catch (err) {
      const isLastAttempt = attempt === retries - 1;
      if (isLastAttempt) {
        console.warn(`[Content grab] All ${retries} attempts failed:`, err.message);
      } else if (attempt === 0) {
        // Only log on first attempt to reduce noise
        console.debug(`[Content grab] Attempt ${attempt + 1} failed, retrying...`);
      }
    }
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  console.warn(`[Content grab] Failed to extract content from tab ${tabId}`);
  return null;
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await requestPageContentWithRetry(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    await requestPageContentWithRetry(tabId);
  }
});

// Relay messages from content script → sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PAGE_CONTENT") {
    if (sender?.tab?.id) {
      pageContentCache.set(sender.tab.id, message);
    }
    // Forward page content to the sidebar
    chrome.runtime.sendMessage(message);
    return true;
  }

  if (message.type === "GET_ACTIVE_PAGE_CONTENT") {
    (async () => {
      let responded = false;
      const ensureResponse = (response) => {
        if (!responded) {
          responded = true;
          sendResponse(response);
        }
      };

      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) {
          console.warn("[GET_ACTIVE_PAGE_CONTENT] No active tab found");
          ensureResponse({ ok: false, error: "No active tab. Click on a webpage first." });
          return;
        }

        console.log(`[GET_ACTIVE_PAGE_CONTENT] Tab: ${activeTab.title} (ID: ${activeTab.id})`);

        // Try fresh first with more retries
        const fresh = await requestPageContentWithRetry(activeTab.id, 8);
        if (fresh?.text) {
          console.log(`[GET_ACTIVE_PAGE_CONTENT] Fresh content: ${fresh.text.length} chars`);
          ensureResponse({ ok: true, data: fresh });
          return;
        }

        // Fall back to cached
        const cached = pageContentCache.get(activeTab.id);
        if (cached?.text) {
          console.log(`[GET_ACTIVE_PAGE_CONTENT] Using cached: ${cached.text.length} chars`);
          ensureResponse({ ok: true, data: cached, stale: true });
          return;
        }

        console.warn(`[GET_ACTIVE_PAGE_CONTENT] No content available`);
        ensureResponse({ ok: false, error: "Content not available. Try clicking refresh." });
      } catch (error) {
        console.error("[GET_ACTIVE_PAGE_CONTENT] Error:", error);
        ensureResponse({ ok: false, error: error?.message || "Unknown error." });
      }
    })();
    return true;
  }

  if (message.type === "OLLAMA_FETCH") {
    (async () => {
      try {
        const response = await fetch(message.url, message.options || {});
        const data = await response.json().catch(() => ({}));
        sendResponse({ ok: response.ok, status: response.status, data });
      } catch (error) {
        sendResponse({ ok: false, status: 0, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message.type === "FETCH_URL_TEXT") {
    (async () => {
      try {
        const response = await fetch(message.url, { timeout: 10000 });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const html = await response.text();
        // Simple text extraction: remove scripts/styles, get body text
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        
        // Remove noise
        ["script", "style", "nav", "footer", "header", "aside", "noscript", "iframe"].forEach(tag => {
          doc.querySelectorAll(tag).forEach(el => el.remove());
        });
        
        // Prefer article/main/[role=main]
        const article = doc.querySelector("article, main, [role='main']");
        const root = article || doc.body;
        
        const text = (root.innerText || root.textContent || "").replace(/\s+/g, " ").trim();
        
        sendResponse({ ok: true, text, title: doc.title || message.url });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || "Failed to fetch" });
      }
    })();
    return true;
  }
  return true;
});
