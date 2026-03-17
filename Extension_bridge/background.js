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
  }
  return true;
});
