// background.js
// Opens the side panel when the extension icon is clicked

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

const pageContentCache = new Map();

async function requestPageContentWithRetry(tabId, retries = 4) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_CONTENT" });
      if (response?.text) {
        pageContentCache.set(tabId, response);
        chrome.runtime.sendMessage(response);
        return response;
      }
    } catch (_) {
      // Content script can be temporarily unavailable right after navigation.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
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
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) {
          sendResponse({ ok: false, error: "No active tab found." });
          return;
        }

        const fresh = await requestPageContentWithRetry(activeTab.id, 4);
        if (fresh?.text) {
          sendResponse({ ok: true, data: fresh });
          return;
        }

        const cached = pageContentCache.get(activeTab.id);
        if (cached?.text) {
          sendResponse({ ok: true, data: cached, stale: true });
          return;
        }

        sendResponse({ ok: false, error: "Could not extract content from this page yet." });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
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
  return true;
});
