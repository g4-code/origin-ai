document.addEventListener("DOMContentLoaded", async () => {
  // Add error boundary
  window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error(
      "Error: ",
      msg,
      "\nURL: ",
      url,
      "\nLine: ",
      lineNo,
      "\nColumn: ",
      columnNo,
      "\nError object: ",
      error
    );
    return false;
  };

  console.log("Sidepanel loaded");
  const etymologyContent = document.getElementById("etymologyContent");
  const usageContent = document.getElementById("usageContent");
  const synonymContent = document.getElementById("synonymContent");

  // Function to update panel content
  function updatePanelContent(data) {
    if (data.success) {
      etymologyContent.innerHTML = DOMPurify.sanitize(
        marked.parse(data.etymology || "No etymology available")
      );
      usageContent.innerHTML = DOMPurify.sanitize(
        marked.parse(data.usage || "No usage examples available")
      );
      synonymContent.innerHTML = DOMPurify.sanitize(
        marked.parse(data.synonyms || "No synonyms/antonyms available")
      );
    } else {
      etymologyContent.textContent = "Error loading etymology";
      usageContent.textContent = "Error loading usage examples";
      synonymContent.textContent = "Error loading synonyms/antonyms";
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Add message validation
    if (!message || typeof message !== "object") return;

    // Add source validation
    if (sender.id !== chrome.runtime.id) return;

    const timer = setTimeout(() => {
      sendResponse({ success: false, error: "Operation timed out" });
    }, 30000); // 30-second timeout

    console.log("Sidepanel received message:", message);
    const loadingSpinner = document.getElementById("loadingSpinner");

    if (message.action === "updateSidePanel") {
      if (loadingSpinner) {
        loadingSpinner.hidden = false;
        loadingSpinner.style.display = "flex";
      }

      chrome.runtime.sendMessage(
        {
          action: "getSidePanelData",
          text: message.word,
          source: "sidepanel",
        },
        async (response) => {
          console.log("...Received data response:", response);

          // Start view transition for spinner fade-out
          if (loadingSpinner) {
            document.startViewTransition(() => {
              loadingSpinner.style.display = "none";
              loadingSpinner.hidden = true;
            });
          }

          updatePanelContent(response || { success: false });
        }
      );
    }

    // Clear timeout on successful response
    return () => clearTimeout(timer);
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

  // Add connection to background
  chrome.runtime.connect({ name: "sidepanel" });
});
