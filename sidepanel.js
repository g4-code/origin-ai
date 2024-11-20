// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "updateSidePanel") {
    document.getElementById("selectedWord").textContent = message.word;
  }
});
