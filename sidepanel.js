document.addEventListener("DOMContentLoaded", async () => {
  const etymologyTextarea = document.getElementById("etymology");
  const usageTextarea = document.getElementById("usage");
  const synonymsTextarea = document.getElementById("synonyms");

  // Set initial loading states
  etymologyTextarea.value = "Loading etymology...";
  usageTextarea.value = "Loading usage examples...";
  synonymsTextarea.value = "Loading synonyms and antonyms...";

  // Get the current tab to fetch its stored word
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      const tabId = tabs[0].id;
      // Request the stored word as soon as the panel loads
      chrome.runtime.sendMessage({
        action: "getStoredWord",
        tabId: tabId,
      });
    }
  } catch (error) {
    console.error("Error getting current tab:", error);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updateSidePanel" && message.word) {
      fetchWordData(message.word);
    }
  });

  async function fetchWordData(word) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getSidePanelData",
        text: word,
      });

      if (response && response.success) {
        updatePanelContent(response);
      }
    } catch (error) {
      console.error("Error fetching word data:", error);
      showError();
    }
  }

  function updatePanelContent(data) {
    if (data.etymology) {
      etymologyTextarea.value = data.etymology;
    }

    if (data.usage) {
      usageTextarea.value = data.usage;
    }

    if (data.synonyms) {
      synonymsTextarea.value = data.synonyms;
    }
  }

  function showError() {
    etymologyTextarea.value = "Error loading etymology";
    usageTextarea.value = "Error loading usage examples";
    synonymsTextarea.value = "Error loading synonyms and antonyms";
  }
});
