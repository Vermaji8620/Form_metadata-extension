// background.js
// Service worker for real-time field monitoring and messaging relay

let sidePanelPort = null;
let latestTabFields = {};

// Store reference to sidepanel port for message relay
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    sidePanelPort = port;
    console.log('%c✅ Sidepanel connected', 'color: #00ff88');

    // Send any pending field data
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const tabId = tabs[0].id;
        if (latestTabFields[tabId] && Array.isArray(latestTabFields[tabId])) {
          // Send all stored fields
          latestTabFields[tabId].forEach(field => {
            port.postMessage({
              action: 'fieldUpdated',
              field: field
            });
          });
        }
      }
    });

    port.onDisconnect.addListener(() => {
      sidePanelPort = null;
      console.log('%c❌ Sidepanel disconnected', 'color: #ff5555');
    });
  }
});

// Relay field updates from content script to sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fieldUpdated') {
    const tabId = sender.tab?.id;
    if (tabId) {
      // Store the latest field data
      if (!latestTabFields[tabId]) {
        latestTabFields[tabId] = [];
      }

      // Find or add this field
      const existingIndex = latestTabFields[tabId].findIndex(f => f.selector === request.field.selector);
      if (existingIndex >= 0) {
        latestTabFields[tabId][existingIndex] = request.field;
      } else {
        latestTabFields[tabId].push(request.field);
      }

      // Relay to sidepanel if connected
      if (sidePanelPort) {
        sidePanelPort.postMessage({
          action: 'fieldUpdated',
          field: request.field
        });
      }
    }
  }
});

console.log('%c✅ Form Inspector background service worker ready', 'color: #00ff88; font-weight: bold');
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});