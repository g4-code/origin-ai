// Store selected words per tab
const tabWords = new Map();
let aiSession = null;

// Initialize AI session
async function initAISession() {
  if (aiSession) return aiSession;

  const capabilities = await chrome.aiOriginTrial.languageModel.capabilities();
  if (capabilities.available === "no") {
    throw new Error("AI model not available");
  }

  // Create session with default parameters
  aiSession = await chrome.aiOriginTrial.languageModel.create({
    temperature: capabilities.defaultTemperature,
    topK: capabilities.defaultTopK,
  });

  return aiSession;
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

async function getUsageExamples(word) {
  try {
    const session = await initAISession();
    const prompt = `Provide 3 clear and concise example sentences using the word "${word}".`;

    const response = await session.prompt(prompt);
    return response || "No examples found.";
  } catch (error) {
    console.error("Error getting usage examples:", error);
    return "Error getting usage examples.";
  }
}

async function getSynonymsAntonyms(word) {
  try {
    const session = await initAISession();
    const prompt = `List 5 synonyms and 5 antonyms for the word "${word}". Format as two separate lists.`;

    const response = await session.prompt(prompt);
    return response || "No synonyms/antonyms found.";
  } catch (error) {
    console.error("Error getting synonyms/antonyms:", error);
    return "Error getting synonyms and antonyms.";
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
    const prompt = `Provide a detailed etymology of "${word}", including its historical development and original language roots.`;
    const response = await session.prompt(prompt);
    return response || "No etymology found.";
  } catch (error) {
    console.error("Error getting sidepanel etymology:", error);
    return "Error getting etymology.";
  }
}

async function getUsageExamplesForSidePanel(word, session) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
    const prompt = `Provide 3 clear and concise example sentences using the word "${word}".`;
    const response = await session.prompt(prompt);
    return response || "No usage examples found.";
  } catch (error) {
    console.error("Error getting usage examples:", error);
    return "Error getting usage examples.";
  }
}

async function getSynonymsAntonymsForSidePanel(word, session) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
    const prompt = `List 5 synonyms and 5 antonyms for the word "${word}". Format as two separate lists.`;
    const response = await session.prompt(prompt);
    return response || "No synonyms/antonyms found.";
  } catch (error) {
    console.error("Error getting synonyms/antonyms:", error);
    return "Error getting synonyms/antonyms.";
  }
}

// async function getRelatedImages(word) {
//   try {
//     const session = await initAISession();
//     const prompt = `Provide the etymology of the word "${word}". Keep the response concise and focused on the word's origins and historical development.`;

//     const response = await session.prompt(prompt);
//     return response || "No etymology found.";
//   } catch (error) {
//     console.error("Error getting etymology:", error);
//     throw error;
//   }
// }

// Keep existing message listeners and tab management code...
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(" in background.js");
  if (message.action === "openSidePanel") {
    // Store the word for this tab
    if (sender.tab) {
      tabWords.set(sender.tab.id, message.word);
    }

    // Open the side panel first
    // chrome.sidePanel
    //   .open({ tabId: sender.tab.id })
    //   .then(() => {
    //     // Add a small delay to ensure the panel is loaded
    //     setTimeout(() => {
    //       console.log("sending message to update side panel");
    //       chrome.runtime
    //         .sendMessage({
    //           action: "updateSidePanel",
    //           word: message.word,
    //         })
    //         .catch((error) => {
    //           // It's okay if this fails, the panel will request the data when it loads
    //           console.log(
    //             "Panel not ready yet, it will request data when loaded"
    //           );
    //         });
    //     }, 1000);
    //   })
    //   .catch((error) => {
    //     console.error("Error opening side panel:", error);
    //   });

    // Open the side panel first
    chrome.sidePanel
      .open({ tabId: sender.tab.id })
      .then(() => {
        // Add a small delay to ensure the panel is loaded
        //setTimeout(() => {
        console.log("sending message to update side panel");
        chrome.runtime
          .sendMessage({
            action: "updateSidePanel",
            word: message.word,
          })
          .catch((error) => {
            // It's okay if this fails, the panel will request the data when it loads
            console.log(
              "Panel not ready yet, it will request data when loaded"
            );
          });
        //}, 1000);
      })
      .catch((error) => {
        console.error("Error opening side panel:", error);
      });

    return true;
  }

  if (message.action === "closeSidePanel") {
    //this.window.close();
    //await chrome.sidePanel.setOptions({ enabled: false, tabId:tab.id })
    // if (sender.tab) {
    //   chrome.sidePanel
    //     .setOptions({ enabled: false, tabId: sender.tab.id })
    //     .catch((error) => {
    //       console.error("Error closing side panel:", error);
    //     });
    // }
    // chrome.sidePanel.setVisible({ visible: false }).catch((error) => {
    //   console.error("Error closing side panel:", error);
    // });

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
    // Send initial loading states
    chrome.runtime.sendMessage({
      action: "updateLoadingStates",
      states: {
        etymology: true,
        usage: true,
        synonyms: true,
      },
    });

    initAISession().then(async (session) => {
      try {
        // Execute requests sequentially
        const etymology = await getEtymologyForSidePanel(message.text, session);
        const usage = await getUsageExamplesForSidePanel(message.text, session);
        const synonyms = await getSynonymsAntonymsForSidePanel(
          message.text,
          session
        );

        // Send completion state
        chrome.runtime.sendMessage({
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
        });

        sendResponse({
          selectedText: message.text,
          etymology,
          usage,
          synonyms,
          success: true,
        });
      } catch (error) {
        console.error("Error processing requests:", error);
        chrome.runtime.sendMessage({
          action: "updateLoadingStates",
          states: {
            etymology: false,
            usage: false,
            synonyms: false,
          },
          error: "Error fetching data",
        });

        sendResponse({
          selectedText: message.text,
          error: "Error fetching data",
          success: false,
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

// chrome.tabs.onActivated.addListener((activeInfo) => {
//   const word = tabWords.get(activeInfo.tabId) || "";

//   // Send message only to the side panel if it exists
//   chrome.runtime
//     .sendMessage({
//       action: "updateSidePanel",
//       word: word,
//     })
//     .catch(() => {
//       // Ignore errors when side panel doesn't exist
//     });
// });
