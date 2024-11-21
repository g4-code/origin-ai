// Initialize the Google AI client - using the API key directly in production code
const API_KEY = "AIzaSyB8fpMQ1UVdBoxCNx7yHgXsFgpn8763GGE";
// Store selected words per tab
const tabWords = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(" in background.js");
  if (message.action === "openSidePanel") {
    // Store the word for this tab
    if (sender.tab) {
      tabWords.set(sender.tab.id, message.word);
    }

    // Open the side panel
    chrome.sidePanel.open({ tabId: sender.tab.id }).catch((error) => {
      console.error("Error opening side panel:", error);
    });

    // Must return false for async operations
    return false;
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

  if (message.action === "getData") {
    Promise.all([
      getEtymology(message.text),
      getUsageExamples(message.text),
      getSynonymsAntonyms(message.text),
      getRelatedImages(message.text),
    ])
      .then(([etymology, usage, synonyms, images]) => {
        sendResponse({
          selectedText: message.text,
          etymology: etymology,
          usage: usage,
          synonyms: synonyms,
          images: images,
          success: true,
        });
      })
      .catch((error) => {
        sendResponse({
          selectedText: message.text,
          error: "Error fetching data",
          success: false,
        });
      });
    return true; // Required for async response
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabWords.delete(tabId);
});

// Handle tab switching
chrome.tabs.onActivated.addListener((activeInfo) => {
  const word = tabWords.get(activeInfo.tabId) || "";

  // Send message only to the side panel if it exists
  chrome.runtime
    .sendMessage({
      action: "updateSidePanel",
      word: word,
    })
    .catch(() => {
      // Ignore errors when side panel doesn't exist
    });
});

// Function to get etymology from AI
async function getEtymology(word) {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=" +
        API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Provide the etymology of the word "${word}". Keep the response concise and focused on the word's origins and historical development.`,
                },
            ***REMOVED***
            },
        ***REMOVED***
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Full API Response:", data); // Debug log

    // Updated response structure handling
    if (
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content
    ) {
      const text = data.candidates[0].content.parts[0].text;
      return text || "No etymology found.";
    }

    throw new Error("Invalid response structure from API");
  } catch (error) {
    console.error("Error getting etymology:", error);
    if (error.message.includes("fetch")) {
      console.error("Network error details:", error);
    }
    throw error;
  }
}

async function getUsageExamples(word) {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=" +
        API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Provide 3 clear and concise example sentences using the word "${word}".`,
                },
            ***REMOVED***
            },
        ***REMOVED***
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    const data = await response.json();
    return data.candidates[0].content.parts[0].text || "No examples found.";
  } catch (error) {
    console.error("Error getting usage examples:", error);
    throw error;
  }
}

async function getSynonymsAntonyms(word) {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=" +
        API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `List 5 synonyms and 5 antonyms for the word "${word}". Format as two separate lists.`,
                },
            ***REMOVED***
            },
        ***REMOVED***
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    const data = await response.json();
    return (
      data.candidates[0].content.parts[0].text || "No synonyms/antonyms found."
    );
  } catch (error) {
    console.error("Error getting synonyms/antonyms:", error);
    throw error;
  }
}

async function getRelatedImages(word) {
  // For now, return placeholder text since image handling requires additional setup
  return "Image functionality will be implemented in the next phase.";
}
