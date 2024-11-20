// Store selected words per tab
const tabWords = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openSidePanel") {
    // Store the word for this tab
    if (sender.tab) {
      tabWords.set(sender.tab.id, message.word);
    }

    // Open the side panel
    chrome.sidePanel.open({ tabId: sender.tab.id });
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabWords.delete(tabId);
});

// Handle tab switching
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const word = tabWords.get(activeInfo.tabId) || "";
  // Update side panel content for the new tab
  chrome.runtime.sendMessage({
    action: "updateSidePanel",
    word: word,
  });
});
