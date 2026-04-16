// background.js
// Service worker for real-time field monitoring and messaging relay

let sidePanelPort = null;
let latestTabFields = {};

console.log('%c✅ Form Inspector background service worker ready', 'color: #00ff88; font-weight: bold');

// Store reference to sidepanel port for message relay
chrome.runtime.onConnect.addListener((port) => {
  console.log('%c🔌 Port connection attempt:', 'color: #ffaa00', port.name);

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
            console.log('%c📤 Sending stored field to sidepanel:', 'color: #00aaff', field);
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
  console.log('%c📨 Background received message:', 'color: #00aaff', request, 'from:', sender);

  if (request.action === 'fieldUpdated') {
    const tabId = sender.tab?.id;
    if (tabId) {
      console.log('%c🔄 Processing field update for tab:', 'color: #ffaa00', tabId);

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
        console.log('%c📤 Relaying field update to sidepanel:', 'color: #00ffaa', request.field);
        sidePanelPort.postMessage({
          action: 'fieldUpdated',
          field: request.field
        });
      } else {
        console.log('%c⚠️ Sidepanel not connected, field update stored', 'color: #ffaa00');
      }
    }
  }
});

console.log('%c✅ Form Inspector background service worker ready', 'color: #00ff88; font-weight: bold');
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});