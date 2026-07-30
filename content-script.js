/**
 * Content Script
 * Runs on every page, sets up form filler and paint can injector
 */

let gen = null;
let paintCan = null;
let settings = null;
let pickerMode = false;
let skipSelectors = [];
let customPickerMode = false;
let customFields = [];

/**
 * Initialize the extension on the page
 */
async function init() {
  try {
    // Load settings
    const stored = await chrome.storage.sync.get();
    settings = {
      enabled: true,
      safeStrings: stored.safeStrings || false,
      plausiblePhone: stored.plausiblePhone || false,
      reconcile: stored.reconcile || false,
      reconcileAttempts: stored.reconcileAttempts || 5,
      reconcileFallback: stored.reconcileFallback || 'random',
      paintCanEnabled: stored.paintCanEnabled || true
    };

    // Initialize test data generator
    gen = new TestFormDataGenerator(chrome.runtime.getURL('lib/testFormData.json'));
    const loaded = await gen.init();

    if (!loaded) {
      console.error('Failed to load test data');
      return;
    }

    // Setup paint can injector if enabled
    if (settings.paintCanEnabled) {
      paintCan = new PaintCanInjector();
      paintCan.activate(handlePaintCanClicked);
    }

    // Load skip selectors
    skipSelectors = stored.skipSelectors || [];

    // Load custom field values
    customFields = stored.customFields || [];

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'fillForm') {
        fillForm(sendResponse);
      } else if (request.action === 'startPicker') {
        startFieldPicker();
        sendResponse({ success: true });
      } else if (request.action === 'startCustomPicker') {
        startCustomFieldPicker();
        sendResponse({ success: true });
      }
    });

  } catch (error) {
    console.error('Content script init error:', error);
  }
}

/**
 * Handle paint can button clicked for a specific form
 */
async function handlePaintCanClicked(form) {
  console.log('Paint can clicked for form:', form);

  // Fill the specific form
  await fillForm(null, form);

  // Show visual feedback
  showNotification('Form filled!');
}

/**
 * Fill a specific form or the first form on page
 */
async function fillForm(sendResponse = null, targetForm = null) {
  try {
    const form = targetForm || document.querySelector('form') || document.body;

    const filler = new FormFiller(gen, Validators, settings, skipSelectors, customFields);
    const filledCount = await filler.fillForm(form);

    if (sendResponse) {
      sendResponse({ success: true, filledCount });
    }

    return filledCount;
  } catch (error) {
    console.error('Fill form error:', error);
    if (sendResponse) {
      sendResponse({ success: false, error: error.message });
    }
  }
}

/**
 * Start field picker mode
 */
function startFieldPicker() {
  pickerMode = true;

  // Add styles for picker mode
  let style = document.querySelector('style[data-form-filler-picker]');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('data-form-filler-picker', 'true');
    document.head.appendChild(style);
  }
  style.textContent = `
    body.form-filler-picker-mode * {
      cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" stroke="%23ef4444" stroke-width="2" fill="none"/><circle cx="16" cy="16" r="2" fill="%23ef4444"/><line x1="16" y1="4" x2="16" y2="8" stroke="%23ef4444" stroke-width="2"/><line x1="16" y1="24" x2="16" y2="28" stroke="%23ef4444" stroke-width="2"/><line x1="4" y1="16" x2="8" y2="16" stroke="%23ef4444" stroke-width="2"/><line x1="24" y1="16" x2="28" y2="16" stroke="%23ef4444" stroke-width="2"/></svg>') 12 12, crosshair !important;
    }
    .form-filler-picker-target {
      user-select: none !important;
    }
    .form-filler-picker-target:hover {
      outline: 3px solid #ef4444 !important;
      outline-offset: 2px !important;
    }
    .form-filler-picker-badge {
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ef4444;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
      cursor: pointer !important;
    }
    .form-filler-picker-badge:hover {
      background: #dc2626;
    }
  `;

  // Add picker class to body for cursor styling
  document.body.classList.add('form-filler-picker-mode');

  // Add picker mode button
  const button = document.createElement('button');
  button.className = 'form-filler-picker-badge';
  button.textContent = 'Exit Picker Mode';
  button.addEventListener('click', stopFieldPicker);
  document.body.appendChild(button);

  // Find all form fields and add picker listeners
  const fields = document.querySelectorAll('input, select, textarea');
  fields.forEach(field => {
    field.classList.add('form-filler-picker-target');
    field.addEventListener('click', handlePickerClick, true);
    field.addEventListener('mousedown', (e) => { if (pickerMode) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  // Add escape key listener to exit picker mode
  document.addEventListener('keydown', handlePickerEscape);

  console.log('Field picker enabled. Click fields to mark them as skip-worthy. Press ESC to exit.');
  showNotification('Picker mode ON - click fields to skip, press ESC to exit');
}


/**
 * Handle field click in picker mode
 */
function handlePickerClick(e) {
  if (!pickerMode) return;
  e.preventDefault();
  e.stopPropagation();

  const field = e.target;
  const pageTitle = document.title || 'Unknown Page';
  const fieldName = field.name || '';
  const elementId = field.id || '';
  const parentId = field.parentElement?.id || '';
  const fieldType = field.type || field.tagName || 'unknown';

  if (!fieldName && !elementId) {
    showNotification('Field has no name/id - cannot skip');
    return;
  }

  // Create skip entry with more details
  const skipEntry = {
    pageTitle: pageTitle,
    parentId: parentId,
    elementId: elementId,
    fieldName: fieldName,
    fieldType: fieldType.toLowerCase(),
    timestamp: new Date().toISOString()
  };

  // Check if already skipped
  const alreadySkipped = skipSelectors.some(entry =>
    (entry.fieldName && fieldName && entry.fieldName === fieldName && entry.pageTitle === pageTitle) ||
    (entry.elementId && elementId && entry.elementId === elementId && entry.pageTitle === pageTitle)
  );

  if (!alreadySkipped) {
    skipSelectors.push(skipEntry);
    field.style.background = '#fee2e2';
    const label = fieldName || elementId || 'field';
    showNotification(`Skipping: ${label}`);

    // Save to storage
    chrome.storage.sync.set({ skipSelectors });
  }
}

/**
 * Handle escape key in picker mode
 */
function handlePickerEscape(e) {
  if (!pickerMode) return;
  if (e.key === 'Escape') {
    stopFieldPicker();
  }
}

/**
 * Stop field picker mode
 */
function stopFieldPicker() {
  if (!pickerMode) return;

  pickerMode = false;

  // Remove picker class from body
  document.body.classList.remove('form-filler-picker-mode');

  // Remove button
  const button = document.querySelector('.form-filler-picker-badge');
  if (button) button.remove();

  // Remove event listeners and classes
  const fields = document.querySelectorAll('.form-filler-picker-target');
  fields.forEach(field => {
    field.classList.remove('form-filler-picker-target');
    field.removeEventListener('click', handlePickerClick, true);
    // Note: inline handlers added in startFieldPicker can't be removed, but they check pickerMode flag
    field.style.background = '';
  });

  document.removeEventListener('keydown', handlePickerEscape);
  showNotification('Picker mode OFF');
}

/**
 * Start custom field picker mode (green) - click a field to define a list of
 * potential values for it, or (for radio/checkbox) which options are eligible
 */
function startCustomFieldPicker() {
  customPickerMode = true;

  let style = document.querySelector('style[data-form-filler-custom-picker]');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('data-form-filler-custom-picker', 'true');
    document.head.appendChild(style);
  }
  style.textContent = `
    body.form-filler-custom-picker-mode * {
      cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" stroke="%2310b981" stroke-width="2" fill="none"/><circle cx="16" cy="16" r="2" fill="%2310b981"/><line x1="16" y1="4" x2="16" y2="8" stroke="%2310b981" stroke-width="2"/><line x1="16" y1="24" x2="16" y2="28" stroke="%2310b981" stroke-width="2"/><line x1="4" y1="16" x2="8" y2="16" stroke="%2310b981" stroke-width="2"/><line x1="24" y1="16" x2="28" y2="16" stroke="%2310b981" stroke-width="2"/></svg>') 12 12, crosshair !important;
    }
    .form-filler-custom-picker-target {
      user-select: none !important;
    }
    .form-filler-custom-picker-target:hover {
      outline: 3px solid #10b981 !important;
      outline-offset: 2px !important;
    }
    .form-filler-custom-picker-badge {
      position: fixed;
      top: 10px;
      right: 10px;
      background: #10b981;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
      cursor: pointer !important;
    }
    .form-filler-custom-picker-badge:hover {
      background: #059669;
    }
  `;

  document.body.classList.add('form-filler-custom-picker-mode');

  const button = document.createElement('button');
  button.className = 'form-filler-custom-picker-badge';
  button.textContent = 'Exit Custom Field Picker';
  button.addEventListener('click', stopCustomFieldPicker);
  document.body.appendChild(button);

  const fields = document.querySelectorAll('input, select, textarea');
  fields.forEach(field => {
    field.classList.add('form-filler-custom-picker-target');
    field.addEventListener('click', handleCustomPickerClick, true);
    field.addEventListener('mousedown', (e) => { if (customPickerMode) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  document.addEventListener('keydown', handleCustomPickerEscape);

  console.log('Custom field picker enabled. Click a field to set its potential values. Press ESC to exit.');
  showNotification('Set Custom Values mode ON - click a field, press ESC to exit');
}

/**
 * Handle field click in custom field picker mode
 */
async function handleCustomPickerClick(e) {
  if (!customPickerMode) return;
  e.preventDefault();
  e.stopPropagation();

  const field = e.target;
  const pageTitle = document.title || 'Unknown Page';
  const fieldName = field.name || '';
  const elementId = field.id || '';

  if (!fieldName && !elementId) {
    showNotification('Field has no name/id - cannot set custom values');
    return;
  }

  const isChoiceField = field.type === 'radio' || field.type === 'checkbox';

  const existingEntry = customFields.find(entry =>
    (entry.fieldName && fieldName && entry.fieldName === fieldName && entry.pageTitle === pageTitle) ||
    (entry.elementId && elementId && entry.elementId === elementId && entry.pageTitle === pageTitle)
  );

  let entry;

  if (isChoiceField) {
    const groupElements = field.name
      ? Array.from(document.querySelectorAll(`input[type="${field.type}"][name="${CSS.escape(field.name)}"]`))
      : [field];

    const options = groupElements.map((el, i) => ({
      value: el.value || `option-${i}`,
      label: getOptionLabel(el) || el.value || `Option ${i + 1}`
    }));

    const preSelected = existingEntry?.optionValues || options.map(o => o.value);
    const selected = await showOptionsDialog(field.type, options, preSelected);
    if (selected === null) return; // cancelled

    entry = {
      pageTitle,
      fieldName,
      elementId: fieldName ? '' : elementId,
      fieldType: field.type,
      optionValues: selected,
      timestamp: new Date().toISOString()
    };
  } else {
    const existingValues = existingEntry?.values || [];
    const values = await showValueListDialog(existingValues);
    if (values === null) return; // cancelled

    if (values.length === 0) {
      showNotification('No values entered - not saved');
      return;
    }

    entry = {
      pageTitle,
      fieldName,
      elementId: fieldName ? '' : elementId,
      fieldType: field.type || field.tagName.toLowerCase(),
      values,
      timestamp: new Date().toISOString()
    };
  }

  // Replace any existing entry for this field, then add the new one
  customFields = customFields.filter(e => e !== existingEntry);
  customFields.push(entry);
  chrome.storage.sync.set({ customFields });

  const label = fieldName || elementId || 'field';
  showNotification(`Saved custom values for: ${label}`);
}

/**
 * Best-effort label lookup for a radio/checkbox option
 */
function getOptionLabel(field) {
  if (field.id) {
    const label = document.querySelector(`label[for="${field.id}"]`);
    if (label) return label.textContent.trim();
  }
  let parent = field.parentNode;
  while (parent && parent.tagName !== 'FORM' && parent !== document.body) {
    if (parent.tagName === 'LABEL') return parent.textContent.trim();
    parent = parent.parentNode;
  }
  return null;
}

/**
 * Handle escape key in custom field picker mode
 */
function handleCustomPickerEscape(e) {
  if (!customPickerMode) return;
  if (e.key === 'Escape') {
    stopCustomFieldPicker();
  }
}

/**
 * Stop custom field picker mode
 */
function stopCustomFieldPicker() {
  if (!customPickerMode) return;

  customPickerMode = false;

  document.body.classList.remove('form-filler-custom-picker-mode');

  const button = document.querySelector('.form-filler-custom-picker-badge');
  if (button) button.remove();

  const fields = document.querySelectorAll('.form-filler-custom-picker-target');
  fields.forEach(field => {
    field.classList.remove('form-filler-custom-picker-target');
    field.removeEventListener('click', handleCustomPickerClick, true);
  });

  document.removeEventListener('keydown', handleCustomPickerEscape);
  showNotification('Set Custom Values mode OFF');
}

/**
 * Show a modal dialog with a textarea for entering a list of potential values.
 * Returns a Promise resolving to a string[] on Save, or null on Cancel/close.
 */
function showValueListDialog(existingValues = []) {
  return new Promise(resolve => {
    const { overlay, box } = createDialogShell('Set Potential Values');

    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:13px;color:#6b7280;margin:0 0 8px;';
    hint.textContent = 'Enter one value per line (or comma-separated). One will be picked at random each time the form is filled.';
    box.appendChild(hint);

    const textarea = document.createElement('textarea');
    textarea.style.cssText = 'width:100%;min-height:120px;padding:8px;font-family:monospace;font-size:13px;border:1px solid #d1d5db;border-radius:4px;box-sizing:border-box;resize:vertical;';
    textarea.value = existingValues.join('\n');
    box.appendChild(textarea);

    const { footer, saveBtn, cancelBtn } = createDialogFooter();
    box.appendChild(footer);

    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };

    saveBtn.addEventListener('click', () => {
      const values = textarea.value
        .split(/[\n,]/)
        .map(v => v.trim())
        .filter(v => v.length > 0);
      cleanup(values);
    });
    cancelBtn.addEventListener('click', () => cleanup(null));

    document.body.appendChild(overlay);
    textarea.focus();
  });
}

/**
 * Show a modal dialog with a checkbox per option (for radio/checkbox groups).
 * Returns a Promise resolving to a string[] of eligible option values on Save,
 * or null on Cancel/close.
 */
function showOptionsDialog(fieldType, options, preSelected = []) {
  return new Promise(resolve => {
    const title = fieldType === 'radio' ? 'Eligible Radio Options' : 'Eligible Checkbox Options';
    const { overlay, box } = createDialogShell(title);

    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:13px;color:#6b7280;margin:0 0 8px;';
    hint.textContent = fieldType === 'radio'
      ? 'Check which options are OK to select. One will be chosen at random each time the form is filled.'
      : 'Check which options are OK to check. Each is independently checked ~50% of the time when the form is filled.';
    box.appendChild(hint);

    const list = document.createElement('div');
    list.style.cssText = 'max-height:220px;overflow-y:auto;';

    const checkboxRefs = [];
    options.forEach(opt => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:13px;cursor:pointer;';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = opt.value;
      cb.checked = preSelected.includes(opt.value);
      cb.style.cssText = 'width:16px;height:16px;cursor:pointer;';

      const text = document.createElement('span');
      text.textContent = opt.label;

      row.appendChild(cb);
      row.appendChild(text);
      list.appendChild(row);
      checkboxRefs.push(cb);
    });
    box.appendChild(list);

    const { footer, saveBtn, cancelBtn } = createDialogFooter();
    box.appendChild(footer);

    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };

    saveBtn.addEventListener('click', () => {
      const selected = checkboxRefs.filter(cb => cb.checked).map(cb => cb.value);
      cleanup(selected);
    });
    cancelBtn.addEventListener('click', () => cleanup(null));

    document.body.appendChild(overlay);
  });
}

/**
 * Build the shared overlay + box shell used by the custom-value dialogs
 */
function createDialogShell(titleText) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, sans-serif;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 20px;
    width: 360px;
    max-width: 90vw;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  `;

  const title = document.createElement('h3');
  title.textContent = titleText;
  title.style.cssText = 'margin:0 0 12px;font-size:15px;color:#1f2937;';
  box.appendChild(title);

  overlay.appendChild(box);

  return { overlay, box };
}

/**
 * Build the shared Save/Cancel footer used by the custom-value dialogs
 */
function createDialogFooter() {
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:8px;margin-top:16px;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'flex:1;padding:10px;border:none;border-radius:4px;background:#10b981;color:white;font-weight:600;cursor:pointer;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'flex:1;padding:10px;border:none;border-radius:4px;background:#f3f4f6;color:#333;font-weight:500;cursor:pointer;';

  footer.appendChild(saveBtn);
  footer.appendChild(cancelBtn);

  return { footer, saveBtn, cancelBtn };
}

/**
 * Show notification
 */
function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 2000);

  // Add animation styles
  if (!document.querySelector('style[data-form-filler]')) {
    const style = document.createElement('style');
    style.setAttribute('data-form-filler', 'true');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Initialize when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
