// background.js
// Opens the side panel when the extension icon is clicked

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Relay messages from content script → sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PAGE_CONTENT") {
    // Forward page content to the sidebar
    chrome.runtime.sendMessage(message);
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
