/**
 * Background Service Worker
 * Handles extension initialization and communication
 */

// Initialize storage with default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    safeStrings: false,
    plausiblePhone: false,
    reconcile: false,
    reconcileAttempts: 5,
    reconcileFallback: 'random',
    paintCanEnabled: true
  });
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(null, (items) => {
      sendResponse(items);
    });
    return true; // Will respond asynchronously
  }

  if (request.action === 'saveSettings') {
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
