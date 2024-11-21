let currentPopup = null;

document.addEventListener("dblclick", async (e) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText) {
    // Remove existing popup if any
    if (currentPopup) {
      currentPopup.remove();
    }

    // Create and position the popup
    const popup = document.createElement("div");
    popup.className = "word-popup";
    popup.style.left = `${e.pageX}px`;
    popup.style.top = `${e.pageY}px`;

    // Create etymology content div
    const etymologyDiv = document.createElement("div");
    etymologyDiv.className = "etymology-content";
    etymologyDiv.textContent = "Getting etymology...";

    // Create button
    const button = document.createElement("button");
    button.textContent = "Open in Side Panel";
    button.addEventListener("click", () => {
      chrome.runtime.sendMessage({
        action: "openSidePanel",
        word: selectedText,
      });
    });

    // Assemble popup
    popup.appendChild(etymologyDiv);
    popup.appendChild(button);
    document.body.appendChild(popup);
    currentPopup = popup;

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getPopupData",
        text: selectedText,
      });

      if (response && response.success) {
        etymologyDiv.textContent = response.etymology;
      } else {
        etymologyDiv.textContent = "Error fetching etymology";
      }
    } catch (error) {
      console.error("Error sending message:", error);
      etymologyDiv.textContent = "Error fetching etymology";
    }
  }
});

// Close popup and side panel when clicking outside
document.addEventListener("click", (e) => {
  if (currentPopup) {
    // Only close if we're not clicking inside the popup
    if (!currentPopup.contains(e.target)) {
      currentPopup.remove();
      currentPopup = null;
      // Send message to close side panel
      chrome.runtime.sendMessage({
        action: "closeSidePanel",
      });
    }
  } else {
    // If there's no popup, close side panel anyway
    chrome.runtime.sendMessage({
      action: "closeSidePanel",
    });
  }
});
