let currentPopup = null;

document.addEventListener("dblclick", async (e) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText) {
    if (currentPopup) {
      currentPopup.remove();
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getData",
        text: selectedText,
      });

      if (response && response.success) {
        const popup = createPopup(
          response.selectedText + response.customMessage,
          e.pageX,
          e.pageY
        );
        document.body.appendChild(popup);
        currentPopup = popup;
      }
    } catch (error) {
      console.error("Error sending message:", error);
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

function createPopup(text, x, y) {
  const popup = document.createElement("div");
  popup.className = "word-popup";

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;

  const moreButton = document.createElement("button");
  moreButton.textContent = "More";
  moreButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      action: "openSidePanel",
      word: text,
    });
  });

  popup.appendChild(textarea);
  popup.appendChild(moreButton);

  // Position the popup near the selected text
  popup.style.left = `${x}px`;
  popup.style.top = `${y + 20}px`;

  return popup;
}
