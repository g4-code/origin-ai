// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "updateSidePanel") {
    if (message.word) {
      chrome.runtime.sendMessage(
        { action: "getData", text: message.word },
        (response) => {
          if (response.success) {
            document.getElementById("etymologyContent").textContent =
              response.etymology;
            document.getElementById("usageContent").textContent =
              response.usage;
            document.getElementById("synonymContent").textContent =
              response.synonyms;
            document.getElementById("imagesContent").textContent =
              response.images;
          } else {
            document.getElementById("etymologyContent").textContent =
              "Error loading data";
            document.getElementById("usageContent").textContent =
              "Error loading data";
            document.getElementById("synonymContent").textContent =
              "Error loading data";
            document.getElementById("imagesContent").textContent =
              "Error loading data";
          }
        }
      );
    }
  }
});
