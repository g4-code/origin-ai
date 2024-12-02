document.addEventListener("DOMContentLoaded", async () => {
  // Add error boundary
  window.onerror = function (msg, url, lineNo, columnNo, error) {
    // console.error(
    //   "Error: ",
    //   msg,
    //   "\nURL: ",
    //   url,
    //   "\nLine: ",
    //   lineNo,
    //   "\nColumn: ",
    //   columnNo,
    //   "\nError object: ",
    //   error
    // );
    return false;
  };

  // console.log("Sidepanel loaded");
  const etymologyContent = document.getElementById("etymologyContent");
  const usageContent = document.getElementById("usageContent");
  const synonymContent = document.getElementById("synonymContent");

  // Function to update panel content
  function updatePanelContent(data) {
    const panelContainer = document.querySelector(".panel-container");

    if (data.success) {
      // Check if any of the responses indicate cancellation
      const isCancelled = [data.etymology, data.usage, data.synonyms].some(
        (response) => response?.cancelled
      );

      if (isCancelled) {
        // Clear existing content
        panelContainer.innerHTML = `
          <div class="cancelled-message">
            New word selected...
          </div>
        `;
        panelContainer.classList.add("cancelled");
        return;
      }

      // Remove cancelled class if it exists
      panelContainer.classList.remove("cancelled");

      // Restore original sections if they were removed
      if (!document.querySelector(".section")) {
        panelContainer.innerHTML = `
          <div class="section">
            <h2>Etymology</h2>
            <div id="etymologyContent" class="content-area"></div>
          </div>
          <div class="section">
            <h2>Usage Examples</h2>
            <div id="usageContent" class="content-area"></div>
          </div>
          <div class="section">
            <h2>Synonyms & Antonyms</h2>
            <div id="synonymContent" class="content-area"></div>
          </div>
        `;
      }

      // Get fresh references to content areas
      const etymologyContent = document.getElementById("etymologyContent");
      const usageContent = document.getElementById("usageContent");
      const synonymContent = document.getElementById("synonymContent");

      etymologyContent.innerHTML = DOMPurify.sanitize(
        marked.parse(
          data.etymology?.message || data.etymology || "No etymology available"
        )
      );
      usageContent.innerHTML = DOMPurify.sanitize(
        marked.parse(
          data.usage?.message || data.usage || "No usage examples available"
        )
      );
      synonymContent.innerHTML = DOMPurify.sanitize(
        marked.parse(
          data.synonyms?.message ||
            data.synonyms ||
            "No synonyms/antonyms available"
        )
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
