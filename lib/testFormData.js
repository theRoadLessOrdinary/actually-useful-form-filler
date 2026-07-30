/**
 * Test Form Data Generator
 * Reads testFormData.json and generates random form values
 * Used for Chrome extension form filling
 */

class TestFormDataGenerator {
  constructor(dataUrl = (typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('lib/testFormData.json') : './lib/testFormData.json')) {
    this.dataUrl = dataUrl;
    this.data = null;
    this.caseMap = {};
  }

  /**
   * Load and parse the JSON data
   */
  async init() {
    try {
      const response = await fetch(this.dataUrl);
      const dataArray = await response.json();
      this.data = dataArray;

      // Build a map for quick lookup
      this.caseMap = {};
      dataArray.forEach(caseSpec => {
        this.caseMap[caseSpec.name] = caseSpec;
      });

      return true;
    } catch (error) {
      console.error('Failed to load testFormData.json:', error);
      return false;
    }
  }

  /**
   * Generate a random value for a given case name
   * @param {string} caseName - The name of the case (e.g., 'first', 'phone', 'dob')
   * @param {object} params - Optional parameters (e.g., {ctlType: 'htmldate'})
   * @returns {string|number} The generated value
   */
  generate(caseName, params = {}) {
    if (!this.caseMap[caseName]) {
      console.warn(`Unknown case: ${caseName}`);
      return '';
    }

    const caseSpec = this.caseMap[caseName];
    return this._executeCase(caseSpec, params);
  }

  /**
   * Internal method to execute a case specification
   */
  _executeCase(caseSpec, params = {}) {
    switch (caseSpec.type) {
      case 'constant':
        return caseSpec.value;

      case 'list':
        return this._pickRandom(caseSpec.values);

      case 'list_multi':
        return this._pickMultiple(caseSpec.values, caseSpec.count, caseSpec.unique, caseSpec.separator);

      case 'rand':
        return this._randomInt(caseSpec.min, caseSpec.max);

      case 'chars':
        return this._randomChars(caseSpec.chars, caseSpec.length);

      case 'implode':
        return this._implodeComponents(caseSpec.components, caseSpec.separator);

      case 'composite':
        return this._compositeComponents(caseSpec.components, caseSpec.separator, caseSpec.trim);

      case 'conditional':
        return this._handleConditional(caseSpec, params);

      case 'concat':
        return this._concatenate(caseSpec.template, caseSpec.components);

      case 'date_future':
        return this._futureDateISO(caseSpec.years_ahead);

      case 'date_relative':
        // This requires the pattern to be provided in params
        console.warn(`date_relative requires pattern matching - not fully implemented`);
        return '';

      case 'alias':
        return this.generate(caseSpec.alias_to, params);

      default:
        console.warn(`Unknown case type: ${caseSpec.type}`);
        return '';
    }
  }

  /**
   * Pick a random item from an array
   */
  _pickRandom(array) {
    if (!array || array.length === 0) return '';
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Pick multiple random items from an array
   */
  _pickMultiple(array, countSpec, unique = false, separator = '') {
    if (!array || array.length === 0) return '';

    const min = countSpec.min || 1;
    const max = countSpec.max || array.length;
    const count = this._randomInt(min, max);

    let selected = [];
    const candidates = unique ? [...array] : array;

    for (let i = 0; i < count; i++) {
      if (candidates.length === 0) break;
      const idx = Math.floor(Math.random() * candidates.length);
      selected.push(candidates[idx]);

      if (unique) {
        candidates.splice(idx, 1);
      }
    }

    return selected.join(separator);
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  _randomInt(min, max) {
    if (typeof min === 'string') {
      if (min === 'currentYear') {
        min = new Date().getFullYear();
      } else {
        min = parseInt(min, 10);
      }
    }
    if (typeof max === 'string') {
      if (max === 'currentYear') {
        max = new Date().getFullYear();
      } else {
        max = parseInt(max, 10);
      }
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random characters from a set
   */
  _randomChars(charSet, length) {
    if (!charSet || length === 0) return '';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charSet[Math.floor(Math.random() * charSet.length)];
    }
    return result;
  }

  /**
   * Implode (join) component results with a separator
   */
  _implodeComponents(components, separator = '') {
    if (!components || components.length === 0) return '';

    const parts = components.map(comp => {
      if (comp.type === 'rand') {
        let value = this._randomInt(comp.min, comp.max);
        if (comp.pad) {
          value = String(value).padStart(comp.pad, '0');
        }
        return value;
      } else if (comp.type === 'chars') {
        return this._randomChars(comp.chars, comp.length);
      } else if (comp.type === 'list') {
        return this._pickRandom(comp.values);
      }
      return '';
    });

    return parts.join(separator);
  }

  /**
   * Composite: combine multiple cases with separator
   */
  _compositeComponents(components, separator = ' ', trim = false) {
    if (!components || components.length === 0) return '';

    const parts = components.map(caseName => {
      return this.generate(caseName);
    });

    let result = parts.join(separator);
    if (trim) {
      result = result.trim();
    }
    return result;
  }

  /**
   * Handle conditional cases (different branches based on parameter)
   */
  _handleConditional(caseSpec, params = {}) {
    const paramValue = params[caseSpec.parameter];

    // Check if we have an exact match branch
    if (caseSpec.branches[paramValue]) {
      return this._executeCase(caseSpec.branches[paramValue], params);
    }

    // Fall back to 'default' branch
    if (caseSpec.branches.default) {
      return this._executeCase(caseSpec.branches.default, params);
    }

    console.warn(`No branch found for ${caseSpec.name} with parameter ${caseSpec.parameter}=${paramValue}`);
    return '';
  }

  /**
   * Concatenate using a template with {0}, {1}, etc. placeholders
   */
  _concatenate(template, components) {
    if (!template || !components) return '';

    const values = components.map(comp => {
      if (comp.type === 'chars') {
        return this._randomChars(comp.chars, this._randomInt(comp.length.min, comp.length.max));
      }
      return '';
    });

    let result = template;
    values.forEach((value, index) => {
      result = result.replace(`{${index}}`, value);
    });

    return result;
  }

  /**
   * Generate a future date (ISO format YYYY-MM-DD)
   */
  _futureDateISO(yearsAhead) {
    const date = new Date();
    date.setFullYear(date.getFullYear() + yearsAhead);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(this._randomInt(1, 28)).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  /**
   * Generate multiple random values (for testing/bulk fill)
   */
  generateMultiple(caseNames, params = {}) {
    const results = {};
    caseNames.forEach(caseName => {
      results[caseName] = this.generate(caseName, params);
    });
    return results;
  }

  /**
   * Get list of all available case names
   */
  getAllCaseNames() {
    return Object.keys(this.caseMap);
  }

  /**
   * Get case specification (for debugging/inspection)
   */
  getCaseSpec(caseName) {
    return this.caseMap[caseName] || null;
  }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TestFormDataGenerator;
}

