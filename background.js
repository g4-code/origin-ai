// Add strict mode
"use strict";
// Store selected words per tab
const tabWords = new Map();
let aiSession = null;

// Add data validation utility
const validateWord = (word) => {
  if (typeof word !== "string") return false;
  if (word.length > 100) return false; // Reasonable length limit
  return /^[\w\s-]+$/i.test(word); // Only allow alphanumeric, spaces, and hyphens
};

// Add rate limiting
const rateLimiter = new Map();
const RATE_LIMIT = 60; // Increase to 60 requests per minute
const RATE_WINDOW = 60000; // Keep 1 minute window
const COOLDOWN_PERIOD = 100; // Reduce cooldown to 100ms

function checkRateLimit(sourceId) {
  const now = Date.now();
  const sourceRequests = rateLimiter.get(sourceId) || [];

  // Clean up old requests
  const recentRequests = sourceRequests.filter(
    (time) => now - time < RATE_WINDOW
  );

  // Add debugging
  console.log(`Rate limit check for ${sourceId}:`, {
    recentRequests: recentRequests.length,
    limit: RATE_LIMIT,
    timeSinceLastRequest: recentRequests.length
      ? now - recentRequests[recentRequests.length - 1]
      : "none",
  });

  // Reset if window is fresh
  if (recentRequests.length === 0) {
    rateLimiter.set(sourceId, [now]);
    return true;
  }

  // More lenient cooldown check
  const lastRequest = recentRequests[recentRequests.length - 1];
  if (lastRequest && now - lastRequest < COOLDOWN_PERIOD) {
    console.log("In cooldown period");
    return true; // Allow request even during cooldown
  }

  if (recentRequests.length >= RATE_LIMIT) {
    if (now - recentRequests[0] >= RATE_WINDOW) {
      rateLimiter.set(sourceId, [now]);
      return true;
    }
    console.log("Rate limit exceeded");
    return false;
  }

  recentRequests.push(now);
  rateLimiter.set(sourceId, recentRequests);
  return true;
}

// Add rate limiter cleanup
setInterval(() => {
  const now = Date.now();
  for (const [tabId, requests] of rateLimiter.entries()) {
    const validRequests = requests.filter((time) => now - time < RATE_WINDOW);
    if (validRequests.length === 0) {
      rateLimiter.delete(tabId);
    } else {
      rateLimiter.set(tabId, validRequests);
    }
  }
}, RATE_WINDOW);

// Initialize AI session
async function initAISession() {
  try {
    if (aiSession) return aiSession;

    const capabilities =
      await chrome.aiOriginTrial.languageModel.capabilities();
    if (capabilities.available !== "readily") {
      throw new Error("AI model not available");
    }

    // Create session with default parameters
    aiSession = await chrome.aiOriginTrial.languageModel.create({
      temperature: capabilities.defaultTemperature,
      topK: capabilities.defaultTopK,
    });

    return aiSession;
  } catch (error) {
    console.error("Error initializing AI session:", error);
    throw error;
  }
}

// Add session refresh logic
async function refreshAISession() {
  if (aiSession) {
    try {
      await aiSession.destroy();
    } catch (error) {
      console.error("Error destroying AI session:", error);
    }
  }
  aiSession = null;
  return initAISession();
}

// Function to get etymology from built-in AI
async function getEtymology(word) {
  try {
    const session = await initAISession();
    const prompt = `Provide the etymology of the word "${word}". Keep the response concise and focused on the word's origins and historical development.`;

    const response = await session.prompt(prompt);
    return response || "No etymology found.";
  } catch (error) {
    console.error("Error getting etymology:", error);
    throw error;
  }
}

// Add request tracking for popup requests
let currentPopupRequest = {
  controller: null,
  word: null,
};

// Update getEtymologyForPopup function
async function getEtymologyForPopup(word) {
  // Cancel any existing request
  if (currentPopupRequest.controller) {
    console.log(
      `Cancelling popup request for word: ${currentPopupRequest.word}`
    );
    currentPopupRequest.controller.abort();
  }

  // Create new abort controller
  const controller = new AbortController();
  currentPopupRequest = {
    controller,
    word,
  };

  const mainPrompt = `Give a very brief etymology of "${word}" in 1-2 sentences.`;
  const fallbackPrompt = `Explain in simple English what the word "${word}" means and where it comes from. Use one short sentence.`;

  try {
    return await retryWithFallback(
      async () => {
        const session = await initAISession();
        // Check if request was cancelled during session init
        if (controller.signal.aborted) {
          throw new Error("Request cancelled");
        }
        const response = await session.prompt(mainPrompt, {
          signal: controller.signal,
        });
        return {
          success: true,
          etymology: response || "No etymology found.",
        };
      },
      async () => {
        const session = await initAISession();
        // Check if request was cancelled
        if (controller.signal.aborted) {
          throw new Error("Request cancelled");
        }
        const response = await session.prompt(fallbackPrompt, {
          signal: controller.signal,
        });
        return {
          success: true,
          etymology: response || "No etymology found.",
        };
      }
    ).catch(async (error) => {
      // Don't retry or show errors for cancelled requests
      if (
        error.message === "Request cancelled" ||
        error.name === "AbortError"
      ) {
        console.log("Request was cancelled, ignoring error");
        return {
          success: false,
          etymology: "Loading new request...",
        };
      }

      // Handle destroyed session
      if (error.name === "InvalidStateError") {
        console.log("Session was destroyed, creating new session");
        await refreshAISession();
        const session = await initAISession();
        const response = await session.prompt(mainPrompt, {
          signal: controller.signal,
        });
        return {
          success: true,
          etymology: response || "No etymology found.",
        };
      }

      throw error; // Re-throw other errors
    });
  } catch (error) {
    console.error("Error in getEtymologyForPopup:", error);
    return {
      success: false,
      etymology:
        error.message === "Request cancelled"
          ? "Loading new request..."
          : "Error fetching etymology. Please try again.",
      error: error.message || "Error fetching etymology",
    };
  } finally {
    // Clear request if it hasn't been replaced
    if (currentPopupRequest.controller === controller) {
      currentPopupRequest = { controller: null, word: null };
    }
  }
}

// Add retry utility
const retryWithFallback = async (fn, fallbackFn, maxRetries = 2) => {
  try {
    return await fn();
  } catch (error) {
    if (error.name === "NotSupportedError" && maxRetries > 0) {
      console.log("Retrying with English-only fallback...");
      try {
        return await fallbackFn();
      } catch (fallbackError) {
        if (maxRetries > 1) {
          return retryWithFallback(fn, fallbackFn, maxRetries - 1);
        }
        throw fallbackError;
      }
    }
    throw error;
  }
};

// Update the etymology function
async function getEtymologyForSidePanel(word, session) {
  const mainPrompt = `Provide a detailed etymology of "${word}" in English, including its historical development and original language roots. If the word comes from a non-English origin, please describe it in English.`;
  const fallbackPrompt = `Explain in simple English: What is the origin and history of the word "${word}"? Focus only on basic English explanation.`;

  return retryWithFallback(
    () => session.prompt(mainPrompt),
    () => session.prompt(fallbackPrompt)
  ).catch((error) => {
    console.error("Error getting sidepanel etymology:", error);
    if (error.name === "NotSupportedError") {
      return "Unable to process this word. The etymology may contain unsupported language characters.";
    }
    return "Error getting etymology.";
  });
}

// Update the usage examples function
async function getUsageExamplesForSidePanel(word, session) {
  const mainPrompt = `Provide 3 clear and concise example sentences in English using the word "${word}".`;
  const fallbackPrompt = `Write 3 very simple English sentences using the word "${word}". Use basic vocabulary only.`;

  return retryWithFallback(
    () => session.prompt(mainPrompt),
    () => session.prompt(fallbackPrompt)
  ).catch((error) => {
    console.error("Error getting usage examples:", error);
    if (error.name === "NotSupportedError") {
      return "Unable to generate examples. The word may contain unsupported language characters.";
    }
    return "Error getting usage examples.";
  });
}

// Update the synonyms function
async function getSynonymsAntonymsForSidePanel(word, session) {
  const mainPrompt = `List 5 synonyms and 5 antonyms in English for the word "${word}". Format as two separate lists.`;
  const fallbackPrompt = `Give me the most basic English words that mean the same as "${word}" and their opposites. Keep it simple.`;

  return retryWithFallback(
    () => session.prompt(mainPrompt),
    () => session.prompt(fallbackPrompt)
  ).catch((error) => {
    console.error("Error getting synonyms/antonyms:", error);
    if (error.name === "NotSupportedError") {
      return "Unable to provide synonyms/antonyms. The word may contain unsupported language characters.";
    }
    return "Error getting synonyms/antonyms.";
  });
}

// Update message listener to handle all sources
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender
  if (!sender.id || sender.id !== chrome.runtime.id) return;

  // Add rate limiting for all sources
  const sourceId = sender.tab ? sender.tab.id : "popup";
  if (!checkRateLimit(sourceId)) {
    sendResponse({ success: false, error: "Rate limit exceeded" });
    return true;
  }

  if (message.action === "getPopupData") {
    // Add debugging
    console.log("Received getPopupData request:", {
      text: message.text,
      sourceId: sender.tab ? sender.tab.id : "popup",
    });

    if (!checkRateLimit(sender.tab ? sender.tab.id : "popup")) {
      console.log("Rate limit check failed");
      sendResponse({
        success: false,
        etymology: "Please wait a moment before trying again.",
        error: "Rate limit exceeded",
      });
      return true;
    }

    getEtymologyForPopup(message.text)
      .then((result) => {
        console.log("Etymology result:", result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error("Error in getPopupData:", error);
        sendResponse({
          success: false,
          etymology: "Error fetching etymology. Please try again.",
          error: error.message || "Error fetching etymology",
        });
      });
    return true;
  }

  if (message.action === "openSidePanel") {
    // Store the word for this tab
    if (sender.tab) {
      tabWords.set(sender.tab.id, message.word);
    }

    // Open the side panel first
    chrome.sidePanel
      .open({ tabId: sender.tab.id })
      .then(() => {
        // Add a small delay to ensure the panel is loaded
        console.log("sending message to update side panel");
        chrome.runtime
          .sendMessage({
            action: "updateSidePanel",
            word: message.word,
          })
          .catch((error) => {
            console.log(
              "Panel not ready yet, it will request data when loaded"
            );
          });
      })
      .catch((error) => {
        console.error("Error opening side panel:", error);
      });

    return true;
  }

  if (message.action === "closeSidePanel") {
    // Clear the stored word for this tab
    if (sender.tab) {
      tabWords.delete(sender.tab.id);
    }

    // Must return false for async operations
    return false;
  }

  if (message.action === "getSidePanelData") {
    // Get the active tab to send loading states
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        const loadingState = {
          action: "updateLoadingStates",
          states: {
            etymology: true,
            usage: true,
            synonyms: true,
          },
          source: message.source,
        };

        // Send loading state to content script
        chrome.tabs.sendMessage(tabs[0].id, loadingState);
        // Send loading state to sidepanel
        chrome.runtime.sendMessage(loadingState);

        initAISession().then(async (session) => {
          try {
            // Execute requests sequentially
            const etymology = await getEtymologyForSidePanel(
              message.text,
              session
            );
            const usage = await getUsageExamplesForSidePanel(
              message.text,
              session
            );
            const synonyms = await getSynonymsAntonymsForSidePanel(
              message.text,
              session
            );

            const completionState = {
              action: "updateLoadingStates",
              states: {
                etymology: false,
                usage: false,
                synonyms: false,
              },
              data: {
                etymology,
                usage,
                synonyms,
              },
              source: message.source,
            };

            // Send completion state to both content script and sidepanel
            chrome.tabs.sendMessage(tabs[0].id, completionState);
            console.log("sending completion state to sidepanel...");
            chrome.runtime.sendMessage(completionState);

            sendResponse({
              selectedText: message.text,
              etymology,
              usage,
              synonyms,
              success: true,
            });
          } catch (error) {
            console.error("Error processing requests:", error);
            const errorState = {
              action: "updateLoadingStates",
              states: {
                etymology: false,
                usage: false,
                synonyms: false,
              },
              error: "Error fetching data",
              source: message.source,
            };

            // Send error state to both content script and sidepanel
            chrome.tabs.sendMessage(tabs[0].id, errorState);
            chrome.runtime.sendMessage(errorState);

            sendResponse({
              selectedText: message.text,
              error: "Error fetching data",
              success: false,
            });
          }
        });
      }
    });
    return true;
  }

  if (message.action === "getStoredWord") {
    const word = tabWords.get(message.tabId);
    if (word) {
      chrome.runtime.sendMessage({
        action: "updateSidePanel",
        word: word,
      });
    }
    return false;
  }
});

// Clean up AI session when extension is unloaded
chrome.runtime.onSuspend.addListener(() => {
  if (aiSession) {
    aiSession.destroy();
    aiSession = null;
  }
});

// Keep existing tab management code...
chrome.tabs.onRemoved.addListener((tabId) => {
  tabWords.delete(tabId);
});
