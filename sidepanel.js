document.addEventListener("DOMContentLoaded", async () => {
  console.log("Sidepanel loaded");
  const etymologyContent = document.getElementById("etymologyContent");
  const usageContent = document.getElementById("usageContent");
  const synonymContent = document.getElementById("synonymContent");

  // Function to update panel content
  function updatePanelContent(data) {
    if (data.success) {
      etymologyContent.textContent = data.etymology || "No etymology available";
      usageContent.textContent = data.usage || "No usage examples available";
      synonymContent.textContent =
        data.synonyms || "No synonyms/antonyms available";
    } else {
      etymologyContent.textContent = "Error loading etymology";
      usageContent.textContent = "Error loading usage examples";
      synonymContent.textContent = "Error loading synonyms/antonyms";
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Sidepanel received message:", message);

    if (message.action === "updateSidePanel") {
      console.log("inside updateSidePanel");
      // Request data for the word
      chrome.runtime.sendMessage(
        {
          action: "getSidePanelData",
          text: message.word,
        },
        (response) => {
          console.log("Received data response:", response);
          updatePanelContent(response);
        }
      );
    }
  });

  // Request data for current tab on load
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.runtime.sendMessage({
        action: "getStoredWord",
        tabId: tabs[0].id,
      });
    }
  });
});
