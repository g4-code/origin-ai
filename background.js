"use strict";
const tabWords = new Map();

const validateWord = (word) => {
  if (typeof word !== "string") return false;
  if (word.length > 100) return false; // Reasonable length limit
  return /^[\w\s-]+$/i.test(word); // Only allow alphanumeric, spaces, and hyphens
};

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

// --- Prompt API Migration: Use LanguageModel instead of chrome.aiOriginTrial.languageModel ---
// Remove aiSession and related session logic
let session = null; // Prompt API session

// --- Prompt API Migration: Helper to create or reuse a session ---
async function getPromptSession(params) {
  if (!session) {
    // Create a new session with the Prompt API
    session = await LanguageModel.create(params);
  }
  return session;
}

// --- Prompt API Migration: Reset session (for error recovery or param changes) ---
async function resetPromptSession() {
  if (session) {
    await session.destroy();
  }
  session = null;
}

// --- Prompt API Migration: Replace getEtymology with Prompt API ---
async function getEtymology(word) {
  try {
    const params = {
      initialPrompts: [
        {
          role: "system",
          content: "You are a helpful and friendly assistant.",
        },
      ],
    };
    const promptSession = await getPromptSession(params);
    const prompt = `Provide the etymology of the word "${word}". Keep the response concise and focused on the word's origins and historical development.`;
    const response = await promptSession.prompt(prompt);
    return response || "No etymology found.";
  } catch (error) {
    console.error("Error getting etymology (Prompt API):", error);
    await resetPromptSession(); // Reset session on error
    throw error;
  }
}

// --- Prompt API Migration: Replace getEtymologyForPopup with Prompt API ---
async function getEtymologyForPopup(word) {
  if (currentPopupRequest.controller) {
    currentPopupRequest.controller.abort();
  }
  const controller = new AbortController();
  currentPopupRequest = { controller, word };
  const mainPrompt = `Give a very brief etymology of "${word}" in 1-2 sentences.`;
  const fallbackPrompt = `Explain in simple English what the word "${word}" means and where it comes from. Use one short sentence.`;
  try {
    return await retryWithFallback(
      async () => {
        const params = {
          initialPrompts: [
            {
              role: "system",
              content: "You are a helpful and friendly assistant.",
            },
          ],
        };
        const promptSession = await getPromptSession(params);
        if (controller.signal.aborted) throw new Error("Request cancelled");
        const response = await promptSession.prompt(mainPrompt);
        return { success: true, etymology: response || "No etymology found." };
      },
      async () => {
        const params = {
          initialPrompts: [
            {
              role: "system",
              content: "You are a helpful and friendly assistant.",
            },
          ],
        };
        const promptSession = await getPromptSession(params);
        if (controller.signal.aborted) throw new Error("Request cancelled");
        const response = await promptSession.prompt(fallbackPrompt);
        return { success: true, etymology: response || "No etymology found." };
      }
    );
  } catch (error) {
    if (error.message === "Request cancelled" || error.name === "AbortError") {
      return { success: false, etymology: "Loading new request..." };
    }
    await resetPromptSession(); // Reset session on error
    throw error;
  }
}

// --- Prompt API Migration: Replace getEtymologyForSidePanel with Prompt API ---
async function getEtymologyForSidePanel(word, _session, signal) {
  const mainPrompt = `Provide a detailed etymology of "${word}" in English, including its historical development and original language roots. If the word comes from a non-English origin, please describe it in English.`;
  const fallbackPrompt = `Explain in simple English: What is the origin and history of the word "${word}"? Focus only on basic English explanation.`;
  return retryWithFallback(
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(mainPrompt);
      return response || "No etymology found.";
    },
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(fallbackPrompt);
      return response || "No etymology found.";
    }
  ).catch(async (error) => {
    if (error.name === "AbortError") {
      return { cancelled: true, message: "New word selected..." };
    }
    await resetPromptSession(); // Reset session on error
    return "Error getting etymology.";
  });
}

// --- Prompt API Migration: Replace getUsageExamplesForSidePanel with Prompt API ---
async function getUsageExamplesForSidePanel(word, _session, signal) {
  const mainPrompt = `Provide 3 clear and concise example sentences in English using the word "${word}".`;
  const fallbackPrompt = `Write 3 very simple English sentences using the word "${word}". Use basic vocabulary only.`;
  return retryWithFallback(
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(mainPrompt);
      return response || "No examples found.";
    },
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(fallbackPrompt);
      return response || "No examples found.";
    }
  ).catch(async (error) => {
    if (error.name === "AbortError") {
      return { cancelled: true, message: "New word selected..." };
    }
    await resetPromptSession(); // Reset session on error
    return "Error getting usage examples.";
  });
}

// --- Prompt API Migration: Replace getSynonymsAntonymsForSidePanel with Prompt API ---
async function getSynonymsAntonymsForSidePanel(word, _session, signal) {
  const mainPrompt = `List 5 synonyms and 5 antonyms in English for the word "${word}". Format as two separate lists.`;
  const fallbackPrompt = `Give me the most basic English words that mean the same as "${word}" and their opposites. Keep it simple.`;
  return retryWithFallback(
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(mainPrompt);
      return response || "No synonyms/antonyms found.";
    },
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(fallbackPrompt);
      return response || "No synonyms/antonyms found.";
    }
  ).catch(async (error) => {
    if (error.name === "AbortError") {
      return { cancelled: true, message: "New word selected..." };
    }
    await resetPromptSession(); // Reset session on error
    return "Error getting synonyms/antonyms.";
  });
}

let currentPopupRequest = {
  controller: null,
  word: null,
};

let currentSidePanelRequest = {
  controller: null,
  word: null,
};

function cancelSidePanelRequest() {
  if (currentSidePanelRequest.controller) {
    console.log(
      `Cancelling sidepanel request for word: ${currentSidePanelRequest.word}`
    );
    currentSidePanelRequest.controller.abort();
    currentSidePanelRequest = { controller: null, word: null };
  }
}

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
        const params = {
          initialPrompts: [
            {
              role: "system",
              content: "You are a helpful and friendly assistant.",
            },
          ],
        };
        const promptSession = await getPromptSession(params);
        // Check if request was cancelled during session init
        if (controller.signal.aborted) {
          throw new Error("Request cancelled");
        }
        const response = await promptSession.prompt(mainPrompt);
        return {
          success: true,
          etymology: response || "No etymology found.",
        };
      },
      async () => {
        const params = {
          initialPrompts: [
            {
              role: "system",
              content: "You are a helpful and friendly assistant.",
            },
          ],
        };
        const promptSession = await getPromptSession(params);
        // Check if request was cancelled
        if (controller.signal.aborted) {
          throw new Error("Request cancelled");
        }
        const response = await promptSession.prompt(fallbackPrompt);
        return {
          success: true,
          etymology: response || "No etymology found.",
        };
      }
    );
  } catch (error) {
    if (error.message === "Request cancelled" || error.name === "AbortError") {
      console.log("Request was cancelled, ignoring error");
      return {
        success: false,
        etymology: "Loading new request...",
      };
    }
    await resetPromptSession(); // Reset session on error
    throw error;
  }
}

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

async function getEtymologyForSidePanel(word, _session, signal) {
  const mainPrompt = `Provide a detailed etymology of "${word}" in English, including its historical development and original language roots. If the word comes from a non-English origin, please describe it in English.`;
  const fallbackPrompt = `Explain in simple English: What is the origin and history of the word "${word}"? Focus only on basic English explanation.`;

  return retryWithFallback(
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(mainPrompt);
      return response || "No etymology found.";
    },
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(fallbackPrompt);
      return response || "No etymology found.";
    }
  ).catch(async (error) => {
    if (error.name === "AbortError") {
      return { cancelled: true, message: "New word selected..." };
    }
    await resetPromptSession(); // Reset session on error
    return "Error getting etymology.";
  });
}

async function getUsageExamplesForSidePanel(word, _session, signal) {
  const mainPrompt = `Provide 3 clear and concise example sentences in English using the word "${word}".`;
  const fallbackPrompt = `Write 3 very simple English sentences using the word "${word}". Use basic vocabulary only.`;

  return retryWithFallback(
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(mainPrompt);
      return response || "No examples found.";
    },
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(fallbackPrompt);
      return response || "No examples found.";
    }
  ).catch(async (error) => {
    if (error.name === "AbortError") {
      return { cancelled: true, message: "New word selected..." };
    }
    await resetPromptSession(); // Reset session on error
    return "Error getting usage examples.";
  });
}

async function getSynonymsAntonymsForSidePanel(word, _session, signal) {
  const mainPrompt = `List 5 synonyms and 5 antonyms in English for the word "${word}". Format as two separate lists.`;
  const fallbackPrompt = `Give me the most basic English words that mean the same as "${word}" and their opposites. Keep it simple.`;

  return retryWithFallback(
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(mainPrompt);
      return response || "No synonyms/antonyms found.";
    },
    async () => {
      const params = {
        initialPrompts: [
          {
            role: "system",
            content: "You are a helpful and friendly assistant.",
          },
        ],
      };
      const promptSession = await getPromptSession(params);
      if (signal?.aborted) throw new Error("Request cancelled");
      const response = await promptSession.prompt(fallbackPrompt);
      return response || "No synonyms/antonyms found.";
    }
  ).catch(async (error) => {
    if (error.name === "AbortError") {
      return { cancelled: true, message: "New word selected..." };
    }
    await resetPromptSession(); // Reset session on error
    return "Error getting synonyms/antonyms.";
  });
}

let sidePanelPorts = new Map();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel") {
    const tabId = port.sender.tab?.id;
    if (tabId) {
      sidePanelPorts.set(tabId, port);
      port.onDisconnect.addListener(() => {
        sidePanelPorts.delete(tabId);
      });
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender
  if (!sender.id || sender.id !== chrome.runtime.id) return;

  if (message.action === "getPopupData") {
    // Cancel any in-flight sidepanel request when new word is selected
    cancelSidePanelRequest();

    // Skip rate limit check for popup requests when cancelling previous request
    const skipRateLimit = currentPopupRequest.controller !== null;

    const sourceId = sender.tab ? sender.tab.id : "popup";
    if (!skipRateLimit && !checkRateLimit(sourceId)) {
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
        return chrome.runtime
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
      .then(() => {
        // Send success response back to content script
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "sidePanelOpenStatus",
          success: true,
        });
      })
      .catch((error) => {
        console.error("Error opening side panel:", error);
        // Send error response back to content script
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "sidePanelOpenStatus",
          success: false,
          error: error.message,
        });
      });

    return true;
  }

  if (message.action === "getSidePanelData") {
    // Cancel any existing request
    if (currentSidePanelRequest.controller) {
      currentSidePanelRequest.controller.abort();
    }

    // Create new abort controller
    const controller = new AbortController();
    currentSidePanelRequest = {
      controller,
      word: message.text,
    };

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

        try {
          // Send loading state to content script
          await chrome.tabs.sendMessage(tabs[0].id, loadingState).catch(() => {
            console.log("Content script not available, skipping loading state");
          });

          // Send loading state to sidepanel
          chrome.runtime.sendMessage(loadingState);

          // --- Prompt API Migration: Remove old initAISession, session is not needed ---
          // const session = await initAISession();
          // The new implementation does not require a session argument, so we pass null

          // Execute requests sequentially
          const etymology = await getEtymologyForSidePanel(
            message.text,
            null, // session is not needed with Prompt API
            controller.signal
          );
          const usage = await getUsageExamplesForSidePanel(
            message.text,
            null,
            controller.signal
          );
          const synonyms = await getSynonymsAntonymsForSidePanel(
            message.text,
            null,
            controller.signal
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

          // Send completion state to content script if it's still available
          await chrome.tabs
            .sendMessage(tabs[0].id, completionState)
            .catch(() => {
              console.log(
                "Content script not available, skipping completion state"
              );
            });

          // Check if side panel is still connected before sending
          const port = sidePanelPorts.get(tabs[0].id);
          if (port) {
            console.log("sending completion state to sidepanel...");
            chrome.runtime.sendMessage(completionState).catch(() => {
              console.log("Side panel disconnected, skipping update");
            });
          }

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

          // Send error state if content script is still available
          await chrome.tabs.sendMessage(tabs[0].id, errorState).catch(() => {
            console.log("Content script not available, skipping error state");
          });

          // Send error to side panel
          chrome.runtime.sendMessage(errorState).catch(() => {
            console.log("Side panel disconnected, skipping error update");
          });

          sendResponse({
            selectedText: message.text,
            error: "Error fetching data",
            success: false,
          });
        } finally {
          // Clear request if it hasn't been replaced
          if (currentSidePanelRequest.controller === controller) {
            currentSidePanelRequest = { controller: null, word: null };
          }
        }
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

chrome.runtime.onSuspend.addListener(() => {
  if (aiSession) {
    aiSession.destroy();
    aiSession = null;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabWords.delete(tabId);
});
