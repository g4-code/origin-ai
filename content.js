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

  // Set fixed positioning for bottom-left corner
  popup.style.position = "fixed"; // Changed from absolute
  popup.style.bottom = "20px"; // Distance from bottom
  popup.style.left = "20px"; // Distance from left

  // Remove the dynamic x,y positioning since we're using fixed bottom-left
  // popup.style.left = `${Math.max(0, Math.min(x, window.innerWidth - 300))}px`;
  // popup.style.top = `${Math.max(0, Math.min(y, window.innerHeight - 200))}px`;

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
    //console.log("tf............", currentEtymologyRequest);
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
          console.log("tf............86", currentEtymologyRequest);
          setButtonLoadingState(button, false);
          return;
        }

        etymologyContent.classList.add("updating");
        setTimeout(() => {
          etymologyContent.textContent = response.etymology;
          etymologyContent.classList.remove("updating");
        }, 200);
        console.log("tf............96", currentEtymologyRequest);
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
    // Create new popup - no need to pass mouse coordinates anymore
    const popup = createSecurePopup();
    popup.className = "etymology-word-popup";

    // Create etymology content div
    const etymologyDiv = document.createElement("div");
    etymologyDiv.className = "etymology-content";
    etymologyDiv.textContent = "Getting etymology...";

    // Create button
    const button = document.createElement("button");
    button.textContent = "Open in Side Panel";
    console.log("init disable............", button);
    setButtonLoadingState(button, true); // Initially disabled while fetching popup data
    currentButton = button;

    button.addEventListener("click", () => {
      setButtonLoadingState(button, true);
      console.log("Sending openSidePanel request...");
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

          // Log when all data is loaded
          if (!isAnyLoading && message.data) {
            console.log("✅ Side panel data fully loaded 172:", {
              etymology: message.data.etymology,
              usage: message.data.usage,
              synonyms: message.data.synonyms,
            });
          } else {
            setButtonLoadingState(currentButton, isAnyLoading);
          }

          if (message.error) {
            console.log("❌ Error loading side panel data:", message.error);
            setButtonLoadingState(currentButton, false);
          }
        }
      }

      // Handle initial side panel open status
      if (message.action === "sidePanelOpenStatus") {
        console.log(
          "🔄 Side panel opening status:",
          message.success ? "Success" : "Failed"
        );
        if (!message.success) {
          console.error("Side panel failed to open:", message.error);
          setButtonLoadingState(currentButton, false);
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
  console.log("setButtonLoadingState............", isLoading);
  button.disabled = isLoading;
  button.textContent = isLoading ? "Loading data..." : "Open in Side Panel";
  button.style.backgroundColor = isLoading ? "#cccccc" : "#48D1CC";
  button.style.cursor = isLoading ? "not-allowed" : "pointer";
}

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
