// Store selected words per tab
const tabWords = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(" in background.js");
  if (message.action === "openSidePanel") {
    // Store the word for this tab
    if (sender.tab) {
      tabWords.set(sender.tab.id, message.word);
    }

    // Open the side panel
    chrome.sidePanel.open({ tabId: sender.tab.id }).catch((error) => {
      console.error("Error opening side panel:", error);
    });

    // Must return false for async operations
    return false;
  }

  if (message.action === "closeSidePanel") {
    //this.window.close();
    //await chrome.sidePanel.setOptions({ enabled: false, tabId:tab.id })
    // if (sender.tab) {
    //   chrome.sidePanel
    //     .setOptions({ enabled: false, tabId: sender.tab.id })
    //     .catch((error) => {
    //       console.error("Error closing side panel:", error);
    //     });
    // }
    // chrome.sidePanel.setVisible({ visible: false }).catch((error) => {
    //   console.error("Error closing side panel:", error);
    // });

    // Clear the stored word for this tab
    if (sender.tab) {
      tabWords.delete(sender.tab.id);
    }

    // Must return false for async operations
    return false;
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabWords.delete(tabId);
});

// Handle tab switching
chrome.tabs.onActivated.addListener((activeInfo) => {
  const word = tabWords.get(activeInfo.tabId) || "";

  // Send message only to the side panel if it exists
  chrome.runtime
    .sendMessage({
      action: "updateSidePanel",
      word: word,
    })
    .catch(() => {
      // Ignore errors when side panel doesn't exist
    });
});
