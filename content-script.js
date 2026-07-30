/**
 * Content Script
 * Runs on every page, sets up form filler and paint can injector
 */

let gen = null;
let paintCan = null;
let settings = null;
let pickerMode = false;
let skipSelectors = [];

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

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'fillForm') {
        fillForm(sendResponse);
      } else if (request.action === 'startPicker') {
        startFieldPicker();
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

    const filler = new FormFiller(gen, Validators, settings, skipSelectors);
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
