/**
 * Settings Script
 * Handle settings page UI and storage
 */

const form = document.getElementById('settingsForm');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const reconcileCheckbox = document.getElementById('reconcile');
const reconcileOptions = document.getElementById('reconcileOptions');
const skipFieldsList = document.getElementById('skipFieldsList');
const clearSkipBtn = document.getElementById('clearSkipBtn');
const customFieldsList = document.getElementById('customFieldsList');
const clearCustomBtn = document.getElementById('clearCustomBtn');

const inputs = {
  safeStrings: document.getElementById('safeStrings'),
  plausiblePhone: document.getElementById('plausiblePhone'),
  reconcile: document.getElementById('reconcile'),
  reconcileAttempts: document.getElementById('reconcileAttempts'),
  reconcileFallback: document.querySelectorAll('input[name="reconcileFallback"]'),
  paintCanEnabled: document.getElementById('paintCanEnabled')
};

let skipSelectors = [];
let customFields = [];

/**
 * Load settings from storage
 */
async function loadSettings() {
  const settings = await chrome.storage.sync.get();

  inputs.safeStrings.checked = settings.safeStrings || false;
  inputs.plausiblePhone.checked = settings.plausiblePhone || false;
  inputs.reconcile.checked = settings.reconcile || false;
  inputs.reconcileAttempts.value = settings.reconcileAttempts || 5;
  inputs.paintCanEnabled.checked = settings.paintCanEnabled !== false;

  // Set reconcile fallback radio
  inputs.reconcileFallback.forEach(radio => {
    radio.checked = radio.value === (settings.reconcileFallback || 'random');
  });

  // Show/hide conditional options
  updateConditionalOptions();

  // Load and display skip fields
  skipSelectors = settings.skipSelectors || [];
  loadSkipFields(skipSelectors);

  // Load and display custom field values
  customFields = settings.customFields || [];
  loadCustomFields(customFields);
}

/**
 * Load and display skip fields
 */
function loadSkipFields(skipSelectors) {
  skipFieldsList.innerHTML = '';

  console.log('loadSkipFields called with:', skipSelectors);

  if (!skipSelectors || skipSelectors.length === 0) {
    skipFieldsList.innerHTML = '<p style="color: #6b7280; font-size: 13px;">No fields marked to skip yet</p>';
    return;
  }

  console.log('Processing', skipSelectors.length, 'skip fields');

  skipSelectors.forEach((entry, index) => {
    // Handle both old string format and new object format
    if (typeof entry === 'string') {
      // Old format - convert to new format for display
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
        background: #f3f4f6;
        border-radius: 4px;
        margin-bottom: 8px;
        font-size: 13px;
      `;
      const label = document.createElement('span');
      label.textContent = entry;

      const deleteContainer = document.createElement('div');
      const deleteInPlace = document.createElement('delete-in-place');
      deleteInPlace.setAttribute('caption', '✕');
      deleteInPlace.setAttribute('confirm', 'OK?');
      deleteInPlace.setAttribute('data-index', index);
      deleteContainer.appendChild(deleteInPlace);

      item.appendChild(label);
      item.appendChild(deleteContainer);
      skipFieldsList.appendChild(item);
      return;
    }

    const item = document.createElement('div');
    item.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px;
      background: #f3f4f6;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 13px;
    `;

    // Safely extract values - use elementId if fieldName is empty
    const fieldName = (entry.fieldName && entry.fieldName.trim()) ? entry.fieldName : '';
    const elementId = (entry.elementId && entry.elementId.trim()) ? entry.elementId : '';
    const pageTitle = (entry.pageTitle && entry.pageTitle.trim()) ? entry.pageTitle : 'Unknown Page';
    const fieldType = (entry.fieldType && entry.fieldType.trim()) ? entry.fieldType : 'unknown';
    const parentId = (entry.parentId && entry.parentId.trim()) ? entry.parentId : '';

    // Use fieldName if it exists, otherwise use elementId
    const displayName = fieldName || elementId || 'Unknown Field';

    const label = document.createElement('span');
    label.style.fontWeight = '600';
    label.textContent = displayName;

    const details = document.createElement('div');
    details.style.cssText = 'color: #6b7280; font-size: 12px; margin-top: 4px;';
    const parentText = parentId ? parentId : 'none';
    details.textContent = `${pageTitle} | Type: ${fieldType} | Parent: ${parentText}`;

    const labelContainer = document.createElement('div');
    labelContainer.style.flex = '1';
    labelContainer.appendChild(label);
    labelContainer.appendChild(details);

    const deleteContainer = document.createElement('div');
    const deleteInPlace = document.createElement('delete-in-place');
    deleteInPlace.setAttribute('caption', '✕');
    deleteInPlace.setAttribute('confirm', 'OK?');
    deleteInPlace.setAttribute('data-index', index);
    deleteContainer.appendChild(deleteInPlace);

    item.appendChild(labelContainer);
    item.appendChild(deleteContainer);
    skipFieldsList.appendChild(item);
  });
}

/**
 * Load and display custom field values
 */
function loadCustomFields(customFields) {
  customFieldsList.innerHTML = '';

  if (!customFields || customFields.length === 0) {
    customFieldsList.innerHTML = '<p style="color: #6b7280; font-size: 13px;">No custom values set yet</p>';
    return;
  }

  customFields.forEach((entry, index) => {
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px;
      background: #f3f4f6;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 13px;
    `;

    const displayName = entry.fieldName || entry.elementId || 'Unknown Field';

    const label = document.createElement('span');
    label.style.fontWeight = '600';
    label.textContent = displayName;

    const details = document.createElement('div');
    details.style.cssText = 'color: #6b7280; font-size: 12px; margin-top: 4px;';

    if (entry.optionValues) {
      details.textContent = `${entry.pageTitle} | Type: ${entry.fieldType} | Eligible: ${entry.optionValues.join(', ') || '(none)'}`;
    } else {
      details.textContent = `${entry.pageTitle} | Type: ${entry.fieldType} | Values: ${(entry.values || []).join(', ')}`;
    }

    const labelContainer = document.createElement('div');
    labelContainer.style.flex = '1';
    labelContainer.appendChild(label);
    labelContainer.appendChild(details);

    const deleteContainer = document.createElement('div');
    const deleteInPlace = document.createElement('delete-in-place');
    deleteInPlace.setAttribute('caption', '✕');
    deleteInPlace.setAttribute('confirm', 'OK?');
    deleteInPlace.setAttribute('data-index', index);
    deleteContainer.appendChild(deleteInPlace);

    item.appendChild(labelContainer);
    item.appendChild(deleteContainer);
    customFieldsList.appendChild(item);
  });
}

/**
 * Clear all custom field values
 */
async function clearAllCustomFields() {
  if (!confirm('Remove all custom field values?')) {
    return;
  }
  await chrome.storage.sync.set({ customFields: [] });
  loadCustomFields([]);
  showStatus('All custom field values cleared', 'success');
}

/**
 * Clear all skip fields
 */
async function clearAllSkipFields() {
  if (!confirm('Remove all fields from skip list?')) {
    return;
  }
  await chrome.storage.sync.set({ skipSelectors: [] });
  loadSkipFields([]);
  showStatus('All skip fields cleared', 'success');
}

/**
 * Update conditional options visibility
 */
function updateConditionalOptions() {
  reconcileOptions.style.display = inputs.reconcile.checked ? 'block' : 'none';
}

/**
 * Save settings to storage
 */
async function saveSettings(e) {
  e.preventDefault();

  const settings = {
    safeStrings: inputs.safeStrings.checked,
    plausiblePhone: inputs.plausiblePhone.checked,
    reconcile: inputs.reconcile.checked,
    reconcileAttempts: parseInt(inputs.reconcileAttempts.value) || 5,
    reconcileFallback: Array.from(inputs.reconcileFallback).find(r => r.checked)?.value || 'random',
    paintCanEnabled: inputs.paintCanEnabled.checked
  };

  try {
    await chrome.storage.sync.set(settings);
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showStatus('Error saving settings: ' + error.message, 'error');
  }
}

/**
 * Reset to default settings
 */
async function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) {
    return;
  }

  const defaults = {
    safeStrings: false,
    plausiblePhone: false,
    reconcile: false,
    reconcileAttempts: 5,
    reconcileFallback: 'random',
    paintCanEnabled: true
  };

  try {
    await chrome.storage.sync.set(defaults);
    await loadSettings();
    showStatus('Settings reset to defaults', 'success');
  } catch (error) {
    showStatus('Error resetting settings: ' + error.message, 'error');
  }
}

/**
 * Show status message
 */
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status show ${type}`;

  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, type === 'success' ? 1500 : 3000);
}

/**
 * Event listeners
 */
form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);
clearSkipBtn.addEventListener('click', clearAllSkipFields);
clearCustomBtn.addEventListener('click', clearAllCustomFields);

skipFieldsList.addEventListener('dip-confirm', (e) => {
  console.log('dip-confirm event fired', e.detail);
  const index = parseInt(e.detail['data-index']);
  console.log('Removing index:', index);
  skipSelectors.splice(index, 1);
  chrome.storage.sync.set({ skipSelectors });
  loadSkipFields(skipSelectors);
  showStatus('Field removed from skip list', 'success');
});

customFieldsList.addEventListener('dip-confirm', (e) => {
  const index = parseInt(e.detail['data-index']);
  customFields.splice(index, 1);
  chrome.storage.sync.set({ customFields });
  loadCustomFields(customFields);
  showStatus('Custom values removed', 'success');
});

reconcileCheckbox.addEventListener('change', () => {
  updateConditionalOptions();
  saveSettings({ preventDefault: () => {} });
});

inputs.safeStrings.addEventListener('change', () => saveSettings({ preventDefault: () => {} }));
inputs.plausiblePhone.addEventListener('change', () => saveSettings({ preventDefault: () => {} }));
inputs.reconcileAttempts.addEventListener('change', () => saveSettings({ preventDefault: () => {} }));
inputs.paintCanEnabled.addEventListener('change', () => saveSettings({ preventDefault: () => {} }));
inputs.reconcileFallback.forEach(radio => {
  radio.addEventListener('change', () => saveSettings({ preventDefault: () => {} }));
});

/**
 * Initialize
 */
loadSettings();
