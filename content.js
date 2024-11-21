let currentPopup = null;

document.addEventListener("dblclick", async (e) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText) {
    if (currentPopup) {
      currentPopup.remove();
    }

    const popup = createPopup(
      `${selectedText}\n\nEtymology:\nGetting etymology...`,
      e.pageX,
      e.pageY
    );
    document.body.appendChild(popup);
    currentPopup = popup;

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getData",
        text: selectedText,
      });

      if (response && response.success) {
        const textarea = popup.querySelector("textarea");
        textarea.value = `${response.selectedText}\n\nEtymology:\n${response.etymology}`;
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const textarea = popup.querySelector("textarea");
      textarea.value = `${selectedText}\n\nEtymology:\nError fetching etymology`;
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
  textarea.style.height = "150px";

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
