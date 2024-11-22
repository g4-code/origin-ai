let currentPopup = null;
let currentButton = null;

// Listen for loading state updates - Move this outside the dblclick event
let messageListener = null;

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
    popup.className = "etymology-word-popup";
    popup.style.left = `${e.pageX}px`;
    popup.style.top = `${e.pageY}px`;

    // Create etymology content div
    const etymologyDiv = document.createElement("div");
    etymologyDiv.className = "etymology-content";
    etymologyDiv.textContent = "Getting etymology...";

    // Create button
    const button = document.createElement("button");
    button.textContent = "Open in Side Panel";
    setButtonLoadingState(button, true); // Initially disabled while fetching popup data
    currentButton = button;

    button.addEventListener("click", () => {
      setButtonLoadingState(button, true);
      chrome.runtime.sendMessage({
        action: "openSidePanel",
        word: selectedText,
      });
    });

    // Remove previous listener if exists
    if (messageListener) {
      chrome.runtime.onMessage.removeListener(messageListener);
    }

    // Create new listener
    messageListener = (message, sender, sendResponse) => {
      if (message.action === "updateLoadingStates" && currentButton) {
        if (message.source === "sidepanel") {
          const isAnyLoading =
            message.states &&
            Object.values(message.states).some((state) => state);
          setButtonLoadingState(currentButton, isAnyLoading);

          if (message.error) {
            setButtonLoadingState(currentButton, false);
          }
        }
      }
    };

    // Add the listener
    chrome.runtime.onMessage.addListener(messageListener);

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
        setButtonLoadingState(button, false); // Enable button after successful response
      } else {
        etymologyDiv.textContent = "Error fetching etymology";
        setButtonLoadingState(button, false); // Enable button even on error to allow retry
      }
    } catch (error) {
      console.error("Error sending message:", error);
      etymologyDiv.textContent = "Error fetching etymology";
      setButtonLoadingState(button, false); // Enable button on error to allow retry
    }
  }
});

// Close popup and side panel when clicking outside
document.addEventListener("click", (e) => {
  if (currentPopup) {
    if (!currentPopup.contains(e.target)) {
      currentPopup.remove();
      currentPopup = null;
      currentButton = null;
      if (messageListener) {
        chrome.runtime.onMessage.removeListener(messageListener);
        messageListener = null;
      }
      chrome.runtime.sendMessage({
        action: "closeSidePanel",
      });
    }
  } else {
    chrome.runtime.sendMessage({
      action: "closeSidePanel",
    });
  }
});

// Add this helper function
function setButtonLoadingState(button, isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? "Loading data..." : "Open in Side Panel";
  button.style.backgroundColor = isLoading ? "#cccccc" : "#48D1CC"; // Gray when disabled, blue when enabled
  button.style.cursor = isLoading ? "not-allowed" : "pointer";
}
