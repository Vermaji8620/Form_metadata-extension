// background.js
// Minimal service worker – only exists because MV3 requires it.
// We don't need it for messaging (sidepanel talks directly to content script via tabs.sendMessage).
console.log('%c✅ Form Inspector background service worker ready', 'color: #00ff88; font-weight: bold');