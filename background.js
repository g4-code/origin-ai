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
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 minute in milliseconds

function checkRateLimit(tabId) {
  const now = Date.now();
  const userRequests = rateLimiter.get(tabId) || [];
  const recentRequests = userRequests.filter(
    (time) => now - time < RATE_WINDOW
  );

  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }

  recentRequests.push(now);
  rateLimiter.set(tabId, recentRequests);
  return true;
}

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

async function getEtymologyForPopup(word) {
  try {
    const session = await initAISession();
    const prompt = `Give a very brief etymology of "${word}" in 1-2 sentences.`;

    const response = await session.prompt(prompt);
    return response || "No etymology found.";
  } catch (error) {
    console.error("Error getting popup etymology:", error);
    throw error;
  }
}

async function getEtymologyForSidePanel(word, session) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
    const prompt = `Provide a detailed etymology of "${word}" in English, including its historical development and original language roots. If the word comes from a non-English origin, please describe it in English.`;
    const response = await session.prompt(prompt);
    return response || "No etymology found.";
  } catch (error) {
    console.error("Error getting sidepanel etymology:", error);
    if (error.name === "NotSupportedError") {
      return "Unable to process this word. The etymology may contain unsupported language characters.";
    }
    return "Error getting etymology.";
  }
}

async function getUsageExamplesForSidePanel(word, session) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
    const prompt = `Provide 3 clear and concise example sentences in English using the word "${word}".`;
    const response = await session.prompt(prompt);
    return response || "No usage examples found.";
  } catch (error) {
    console.error("Error getting usage examples:", error);
    if (error.name === "NotSupportedError") {
      return "Unable to generate examples. The word may contain unsupported language characters.";
    }
    return "Error getting usage examples.";
  }
}

async function getSynonymsAntonymsForSidePanel(word, session) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
    const prompt = `List 5 synonyms and 5 antonyms in English for the word "${word}". Format as two separate lists.`;
    const response = await session.prompt(prompt);
    return response || "No synonyms/antonyms found.";
  } catch (error) {
    console.error("Error getting synonyms/antonyms:", error);
    if (error.name === "NotSupportedError") {
      return "Unable to provide synonyms/antonyms. The word may contain unsupported language characters.";
    }
    return "Error getting synonyms/antonyms.";
  }
}

// Keep existing message listeners and tab management code...
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(" in background.js");
  // Validate sender
  if (!sender.id || sender.id !== chrome.runtime.id) return;

  // Add rate limiting
  if (sender.tab && !checkRateLimit(sender.tab.id)) {
    sendResponse({ success: false, error: "Rate limit exceeded" });
    return;
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

  if (message.action === "getPopupData") {
    // Lightweight query just for popup
    getEtymologyForPopup(message.text)
      .then((etymology) => {
        sendResponse({
          selectedText: message.text,
          etymology: etymology,
          success: true,
        });
      })
      .catch((error) => {
        sendResponse({
          selectedText: message.text,
          etymology: "Error fetching etymology",
          success: false,
        });
      });
    return true;
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
