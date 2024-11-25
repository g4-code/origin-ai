"use strict";

let currentPopup = null;
let currentButton = null;

// Create message listener outside dblclick event to avoid memory leaks
let messageListener = null;

// Add input sanitization
const sanitizeInput = (text) => {
  return text.replace(/[<>&'"]/g, "");
};

// Add security checks for popup creation
const createSecurePopup = (x, y) => {
  const popup = document.createElement("div");

  // Sanitize positioning
  popup.style.left = `${Math.max(0, Math.min(x, window.innerWidth - 300))}px`;
  popup.style.top = `${Math.max(0, Math.min(y, window.innerHeight - 200))}px`;

  // Add security attributes
  popup.setAttribute("data-origin", "extension");
  popup.setAttribute("data-secure", "true");

  return popup;
};

document.addEventListener("dblclick", async (e) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  // Add input validation
  if (!selectedText || selectedText.length > 100) return;

  const sanitizedText = sanitizeInput(selectedText);

  if (sanitizedText) {
    // Remove existing popup if any
    if (currentPopup) {
      currentPopup.remove();
    }

    // Create and position the popup
    // Create secure popup
    const popup = createSecurePopup(e.pageX, e.pageY);
    //const popup = document.createElement("div");
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
        word: sanitizedText,
      });
    });

    // Remove previous listener to prevent duplicates
    if (messageListener) {
      chrome.runtime.onMessage.removeListener(messageListener);
    }

    // Create new listener for loading state updates
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
        text: sanitizedText,
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

/**
 * Sets the loading state for the popup button
 * @param {HTMLButtonElement} button - The button element to update
 * @param {boolean} isLoading - Whether the button should show loading state
 */
function setButtonLoadingState(button, isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? "Loading data..." : "Open in Side Panel";
  button.style.backgroundColor = isLoading ? "#cccccc" : "#48D1CC";
  button.style.cursor = isLoading ? "not-allowed" : "pointer";
}

/**
 * Message listener for handling loading state updates from the side panel
 * @param {Object} message - Message object from chrome.runtime
 * @param {Object} sender - Sender information
 * @param {Function} sendResponse - Callback function
 */
messageListener = (message, sender, sendResponse) => {
  if (message.action === "updateLoadingStates" && currentButton) {
    if (message.source === "sidepanel") {
      const isAnyLoading =
        message.states && Object.values(message.states).some((state) => state);
      setButtonLoadingState(currentButton, isAnyLoading);

      if (message.error) {
        setButtonLoadingState(currentButton, false);
      }
    }
  }
};

// Add cleanup function
function cleanup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
    currentButton = null;
  }
  if (messageListener) {
    chrome.runtime.onMessage.removeListener(messageListener);
    messageListener = null;
  }
}
// Add proper cleanup on unload
window.addEventListener("unload", cleanup);
