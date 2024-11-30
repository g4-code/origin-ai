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

// Add at the top with other state variables
let currentEtymologyRequest = null;

// Add error handling helper function at the top with other functions
const handleExtensionError = (etymologyContent, button) => {
  etymologyContent.classList.add("updating");
  setTimeout(() => {
    etymologyContent.textContent =
      "Please reload your browser to continue using the extension";
    etymologyContent.style.color = "#ff4444";
    etymologyContent.classList.remove("updating");
  }, 200);
  if (button) {
    setButtonLoadingState(button, false);
    button.style.display = "none"; // Hide the button when extension is invalid
  }
};

// Update the fetchEtymology function to handle extension invalidation
function fetchEtymology(word, etymologyContent, button) {
  try {
    // Cancel any existing request
    if (currentEtymologyRequest) {
      chrome.runtime.sendMessage({
        action: "cancelRequest",
        requestId: currentEtymologyRequest,
      });
    }

    // Generate new request ID
    currentEtymologyRequest = Date.now().toString();

    chrome.runtime.sendMessage(
      {
        action: "getPopupData",
        text: word,
        requestId: currentEtymologyRequest,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          handleExtensionError(etymologyContent, button);
          return;
        }

        if (!response || !response.success) {
          etymologyContent.classList.add("updating");
          setTimeout(() => {
            etymologyContent.textContent = "Error fetching etymology";
            etymologyContent.classList.remove("updating");
          }, 200);
          setButtonLoadingState(button, false);
          return;
        }

        etymologyContent.classList.add("updating");
        setTimeout(() => {
          etymologyContent.textContent = response.etymology;
          etymologyContent.classList.remove("updating");
        }, 200);
        setButtonLoadingState(button, false);
      }
    );
  } catch (error) {
    if (error.message.includes("Extension context invalidated")) {
      handleExtensionError(etymologyContent, button);
    } else {
      console.error("Unexpected error:", error);
      etymologyContent.textContent = "An unexpected error occurred";
    }
  }
}

document.addEventListener("dblclick", (e) => {
  // Remove existing popup if any
  if (currentPopup) {
    currentPopup.remove();
  }

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  // Add input validation
  if (!selectedText || selectedText.length > 100) return;

  const sanitizedText = sanitizeInput(selectedText);

  if (sanitizedText) {
    // Create new popup
    const popup = createSecurePopup(e.pageX, e.pageY);
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
          // Add explicit handling for cancellation
          if (message.cancelled) {
            setButtonLoadingState(currentButton, false);
            return;
          }

          const isAnyLoading =
            message.states &&
            Object.values(message.states).some((state) => state);
          setButtonLoadingState(currentButton, isLoading);

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

    const etymologyContent = popup.querySelector(".etymology-content");
    fetchEtymology(selectedText, etymologyContent, button);
  }
});

// Close popup and side panel when clicking outside
document.addEventListener("click", (e) => {
  if (currentPopup) {
    if (!currentPopup.contains(e.target)) {
      currentPopup.classList.add("closing");
      currentPopup.addEventListener(
        "animationend",
        () => {
          currentPopup.remove();
          currentPopup = null;
          currentButton = null;

          // We remove the listener here
          if (messageListener && chrome.runtime?.onMessage) {
            chrome.runtime.onMessage.removeListener(messageListener);
            messageListener = null;
          }

          // And send close message
          if (chrome.runtime?.id) {
            chrome.runtime.sendMessage({
              action: "closeSidePanel",
            });
          }
        },
        { once: true }
      );
    }
  } else {
    // Check if chrome.runtime exists before sending message
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        action: "closeSidePanel",
      });
    }
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
      // Add explicit handling for cancellation
      if (message.cancelled) {
        setButtonLoadingState(currentButton, false);
        return;
      }

      const isAnyLoading =
        message.states && Object.values(message.states).some((state) => state);
      setButtonLoadingState(currentButton, isLoading);

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
  if (messageListener && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.removeListener(messageListener);
    messageListener = null;
  }
}
// Add proper cleanup on unload
window.addEventListener("unload", cleanup);
