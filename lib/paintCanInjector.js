/**
 * Paint Can Injector
 * Injects a paint can icon button next to the first visible input in each form
 * Clicking the button triggers form filling
 */

class PaintCanInjector {
  constructor() {
    this.buttons = [];
  }

  /**
   * Find first visible text/email/tel input or textarea in a container
   */
  findFirstVisibleInput(container) {
    const inputs = container.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea');
    for (const input of inputs) {
      if (input.offsetParent !== null && input.offsetWidth > 0 && input.offsetHeight > 0) {
        return input;
      }
    }
    return null;
  }

  /**
   * Load and inject paint can icons inside the first visible input in each form
   */
  activate(callback) {
    const forms = document.querySelectorAll('form');

    if (forms.length === 0) {
      console.warn('Paint can injector: No forms found on page');
      return false;
    }

    forms.forEach((form) => {
      const firstInput = this.findFirstVisibleInput(form);
      if (firstInput) {
        this._injectIconIntoInput(firstInput, () => {
          callback(form);
        });
        this.buttons.push(firstInput);
      }
    });

    if (this.buttons.length === 0) {
      console.warn('Paint can injector: No visible input fields found in any form');
      return false;
    }

    return true;
  }

  /**
   * Inject button inside the input field on the right end
   */
  _injectIconIntoInput(input, callback) {
    // Wrap input in a position:relative container if not already wrapped
    let container = input.parentNode;

    // Check if parent is already a wrapper we created
    if (!container.classList.contains('form-filler-input-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'form-filler-input-wrapper';
      wrapper.style.cssText = `
        position: relative;
        display: inline-block;
        width: 100%;
      `;
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      container = wrapper;
    }

    const button = this.createPaintCanButton(callback);
    container.appendChild(button);

    // Add padding to input so text doesn't overlap the button
    const currentPadding = window.getComputedStyle(input).paddingRight;
    const paddingValue = parseFloat(currentPadding) || 8;
    input.style.paddingRight = (paddingValue + 36) + 'px';
  }

  /**
   * Create the paint can button element (transparent with just the icon)
   */
  createPaintCanButton(callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Fill form with test data');
    button.className = 'form-filler-paint-can-btn';
    button.style.cssText = `
      position: absolute;
      right: 2px;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
      height: 28px;
      padding: 2px;
      background: transparent;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
      opacity: 0.6;
      z-index: 100;
      flex-shrink: 0;
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (callback) callback();
    });

    button.addEventListener('mouseover', (e) => {
      e.currentTarget.style.opacity = '1';
    });

    button.addEventListener('mouseout', (e) => {
      e.currentTarget.style.opacity = '0.6';
    });

    // Load SVG asynchronously
    this._loadSVG(button);

    return button;
  }

  /**
   * Load paint-can.svg and inject into button
   */
  async _loadSVG(container) {
    try {
      const svgPath = chrome.runtime.getURL('icons/paint-can.svg');
      const response = await fetch(svgPath);
      if (response.ok) {
        const svgText = await response.text();
        container.innerHTML = svgText;
        // Style the SVG to fit the button
        const svg = container.querySelector('svg');
        if (svg) {
          svg.style.width = '20px';
          svg.style.height = '20px';
          svg.style.display = 'block';
        }
      } else {
        container.textContent = '🎨';
      }
    } catch (error) {
      console.warn('Failed to load paint can SVG, using fallback:', error);
      container.textContent = '🎨';
    }
  }

  /**
   * Remove the injected button
   */
  deactivate() {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
    this.targetInput = null;
    this.injected = false;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaintCanInjector;
}
