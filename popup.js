/**
 * Popup Script
 * Handle popup UI and settings sync
 */

const fillBtn = document.getElementById('fillBtn');
const settingsBtn = document.getElementById('settingsBtn');
const pickerBtn = document.getElementById('pickerBtn');
const customPickerBtn = document.getElementById('customPickerBtn');
const statusDiv = document.getElementById('status');
const checkboxes = {
  safeStrings: document.getElementById('safeStrings'),
  plausiblePhone: document.getElementById('plausiblePhone'),
  reconcile: document.getElementById('reconcile'),
  paintCanEnabled: document.getElementById('paintCanEnabled')
};

/**
 * Load settings from storage
 */
async function loadSettings() {
  const settings = await chrome.storage.sync.get();
  checkboxes.safeStrings.checked = settings.safeStrings || false;
  checkboxes.plausiblePhone.checked = settings.plausiblePhone || false;
  checkboxes.reconcile.checked = settings.reconcile || false;
  checkboxes.paintCanEnabled.checked = settings.paintCanEnabled !== false; // Default true
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  const settings = {
    safeStrings: checkboxes.safeStrings.checked,
    plausiblePhone: checkboxes.plausiblePhone.checked,
    reconcile: checkboxes.reconcile.checked,
    paintCanEnabled: checkboxes.paintCanEnabled.checked
  };

  await chrome.storage.sync.set(settings);
}

/**
 * Fill form on current page
 */
async function fillForm() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillForm'
    });

    if (response.success) {
      showStatus(`Filled ${response.filledCount} fields!`, 'success');
    } else {
      showStatus('Error filling form', 'error');
    }
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
}

/**
 * Open settings page
 */
async function openSettings() {
  await chrome.runtime.openOptionsPage();
}

/**
 * Show status message
 */
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status show ${type}`;

  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}

/**
 * Start field picker mode
 */
async function startPicker() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content script if needed
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['lib/testFormData.js', 'lib/validators.js', 'lib/formFiller.js', 'lib/paintCanInjector.js', 'content-script.js']
      });
    } catch (e) {
      // Script may already be injected, ignore
    }

    await chrome.tabs.sendMessage(tab.id, {
      action: 'startPicker'
    });

    showStatus('Click fields to skip them. Close this popup when done.', 'success');
    window.close();
  } catch (error) {
    showStatus('Must be on a regular web page (not special pages like chrome://', 'error');
  }
}

/**
 * Start custom field picker mode
 */
async function startCustomPicker() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content script if needed
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['lib/testFormData.js', 'lib/validators.js', 'lib/formFiller.js', 'lib/paintCanInjector.js', 'content-script.js']
      });
    } catch (e) {
      // Script may already be injected, ignore
    }

    await chrome.tabs.sendMessage(tab.id, {
      action: 'startCustomPicker'
    });

    showStatus('Click a field to set its custom values. Close this popup when done.', 'success');
    window.close();
  } catch (error) {
    showStatus('Must be on a regular web page (not special pages like chrome://', 'error');
  }
}

/**
 * Event listeners
 */
fillBtn.addEventListener('click', fillForm);
settingsBtn.addEventListener('click', openSettings);
pickerBtn.addEventListener('click', startPicker);
customPickerBtn.addEventListener('click', startCustomPicker);

Object.values(checkboxes).forEach(checkbox => {
  checkbox.addEventListener('change', saveSettings);
});

/**
 * Initialize
 */
loadSettings();
