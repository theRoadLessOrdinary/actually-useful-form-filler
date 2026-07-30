/**
 * Form Filler
 * Detects form fields and intelligently fills them with test data
 */

class FormFiller {
  constructor(gen, validators, settings = {}, skipSelectors = []) {
    this.gen = gen;
    this.validators = validators;
    this.settings = settings;
    this.fieldData = {};
    this.skipSelectors = skipSelectors || [];
  }

  /**
   * Detect all form fields and assign data types
   */
  detectFields(form) {
    const fields = [];
    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach((field, index) => {
      if (!this._isVisible(field)) return;

      const dataType = this._detectDataType(field);
      fields.push({
        element: field,
        index: index,
        type: field.tagName.toLowerCase(),
        dataType: dataType,
        name: field.name || '',
        id: field.id || '',
        fieldType: field.type || ''
      });
    });

    return fields;
  }

  /**
   * Detect data type: dv attribute > smart detection > fallback
   */
  _detectDataType(field) {
    // 1. Check for explicit dv attribute
    if (field.hasAttribute('dv')) {
      return field.getAttribute('dv');
    }

    // 2. Smart detection based on field name/id/aria
    const identifier = `${field.name} ${field.id} ${field.getAttribute('aria-label') || ''} ${field.placeholder || ''}`.toLowerCase();

    const patterns = {
      first: /first[\s_-]?name|firstname|fname|first/,
      last: /last[\s_-]?name|lastname|lname|last|surname/,
      email: /email|e[\s_-]?mail/,
      phone: /phone|tel|mobile|cell/,
      zipcode: /zip|postal[\s_-]?code|zip[\s_-]?code/,
      city: /city|town/,
      state: /state|province|region|st\b/,
      street: /street|address|addr|street[\s_-]?address|address1|street1/,
      company: /company|employer|business|organization|org/,
      occupation: /occupation|job|title|position|job[\s_-]?title/,
      salary: /salary|wage|income|compensation/,
      dob: /birth|dob|date[\s_-]?of[\s_-]?birth|birthday/
    };

    let detectedType = null;
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(identifier)) {
        detectedType = type;
        break;
      }
    }

    // Special case: if detected as street, check label for apartment/suite indicators
    if (detectedType === 'street') {
      const label = this._getFieldLabel(field);
      if (label && /apartment|apt|suite|ste/i.test(label)) {
        return 'apartment';
      }
    }

    if (detectedType) {
      return detectedType;
    }

    // 3. Fallback based on field type
    if (field.tagName === 'SELECT') {
      return 'dropdown';
    }
    if (field.type === 'email') {
      return 'email';
    }
    if (field.type === 'tel') {
      return 'phone';
    }

    return 'unknown';
  }

  /**
   * Get associated label text for a field
   */
  _getFieldLabel(field) {
    // Check if field has a label associated via id
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label.textContent;
    }

    // Check if field's name matches a label's htmlFor
    if (field.name) {
      const label = document.querySelector(`label[for="${field.name}"]`);
      if (label) return label.textContent;
    }

    // Check if label wraps the field
    let parent = field.parentNode;
    while (parent && parent.tagName !== 'FORM' && parent !== document.body) {
      if (parent.tagName === 'LABEL') {
        return parent.textContent;
      }
      parent = parent.parentNode;
    }

    return null;
  }

  /**
   * Check if field is visible
   */
  _isVisible(element) {
    return element.offsetParent !== null && element.offsetWidth > 0 && element.offsetHeight > 0;
  }

  /**
   * Check if field should be skipped
   */
  _shouldSkip(field) {
    if (this.skipSelectors.length === 0) return false;

    const fieldName = field.name;
    const fieldId = field.id;
    const currentPageTitle = document.title;

    // Check if this field matches any skip entry
    return this.skipSelectors.some(entry => {
      // Match by element id first (most specific)
      if (entry.elementId && fieldId && entry.elementId === fieldId && entry.pageTitle === currentPageTitle) {
        return true;
      }
      // Match by field name and page title (only if both have non-empty names)
      if (entry.fieldName && fieldName && entry.fieldName === fieldName && entry.pageTitle === currentPageTitle) {
        return true;
      }
      return false;
    });
  }

  /**
   * Generate value for a field
   */
  async generateValue(field) {
    const dataType = field.dataType;

    // Ensure generator is available
    if (!this.gen) {
      console.warn('Form filler: Generator not initialized');
      return '';
    }

    console.log('Generating value for dataType:', dataType);

    switch (dataType) {
      case 'first':
        return this.gen.generate('first');

      case 'last':
        let last = this.gen.generate('last');
        // Remove -TEST suffix if present
        if (last.endsWith('-TEST')) {
          last = last.slice(0, -5);
        }
        return last;

      case 'email':
        return this._generateIntelligentEmail(
          this.fieldData.first,
          this.fieldData.last,
          this.fieldData.company
        );

      case 'phone':
        if (this.settings.plausiblePhone) {
          return this.validators.generatePlausiblePhone();
        } else {
          return this.gen.generate('phone');
        }

      case 'zipcode':
        if (this.settings.reconcile) {
          const reconciled = await this.validators.generateReconciled(
            this.settings.reconcileAttempts || 5
          );
          if (reconciled) {
            this.fieldData.zipcode = reconciled.zipcode;
            this.fieldData.city = reconciled.city;
            this.fieldData.state = reconciled.state;
            return reconciled.zipcode;
          } else {
            if (this.settings.reconcileFallback === 'blank') {
              return '';
            } else {
              return this.validators.generateValidZipcode();
            }
          }
        } else {
          return this.validators.generateValidZipcode();
        }

      case 'city':
        if (this.fieldData.city) return this.fieldData.city;
        return this.gen.generate('city');

      case 'state':
        if (this.fieldData.state) return this.fieldData.state;
        return this.gen.generate('state');

      case 'street':
        return this.gen.generate('streetaddress');

      case 'apartment':
        // Only fill 20% of the time (apartment is usually optional)
        if (Math.random() > 0.2) {
          return '';
        }
        // Generate apartment/unit number (e.g., "Apt 123", "Suite 456")
        const aptNum = Math.floor(Math.random() * 500) + 1;
        return `Apt ${aptNum}`;

      case 'company':
        return this.gen.generate('company');

      case 'occupation':
        return this.gen.generate('occupation');

      case 'salary':
        return this.gen.generate('salary-annual');

      case 'dob':
        return this.gen.generate('dob', { ctlType: 'htmldate' });

      case 'dropdown':
        return this._selectRandomOption(field.element);

      default:
        // Unknown: generate random company for text input
        if (field.fieldType === 'text') {
          const value = this.gen.generate('company');
          return value || '';
        }
        return '';
    }
  }

  /**
   * Sanitize company name for use as email domain (alphanumeric and hyphens only)
   */
  _sanitizeDomain(companyName) {
    return companyName
      .toLowerCase()
      .replace(/\s+/g, '')          // Remove spaces
      .replace(/[^a-z0-9-]/g, '');  // Keep only alphanumeric and hyphens
  }

  /**
   * Generate intelligent email based on available name/company data
   */
  _generateIntelligentEmail(firstName = null, lastName = null, employerName = null) {
    // Case 1: Has first, last, and employer
    if (firstName && lastName && employerName) {
      const domain = this._sanitizeDomain(employerName);
      return `${firstName[0].toLowerCase()}${lastName.toLowerCase()}@${domain}.com`;
    }

    // Case 2: Has first and last (but no employer) - use random company from generator
    if (firstName && lastName) {
      const company = this.gen.generate('company');
      const domain = this._sanitizeDomain(company);
      return `${firstName[0].toLowerCase()}${lastName.toLowerCase()}@${domain}.com`;
    }

    // Case 3: No last name or no name data
    const randomLast = this.gen.generate('last');
    const randomCompany = this.gen.generate('company');
    const randomInitial = String.fromCharCode(65 + Math.floor(Math.random() * 26)).toLowerCase();

    const domain = this._sanitizeDomain(randomCompany);
    return `${randomInitial}${randomLast.toLowerCase()}@${domain}.com`;
  }

  /**
   * Select random option from dropdown
   */
  _selectRandomOption(select) {
    const options = Array.from(select.options).filter(opt => opt.value && opt.text.trim());
    if (options.length === 0) return '';

    const randomOption = options[Math.floor(Math.random() * options.length)];
    return randomOption.value;
  }

  /**
   * Fill a form with test data
   */
  async fillForm(form) {
    const fields = this.detectFields(form);
    console.log('FormFiller: Detected', fields.length, 'fields');
    this.fieldData = {}; // Reset field data
    const fieldValues = {}; // Store all generated values

    // Separate email fields from other fields, excluding skipped fields
    const emailFields = fields.filter(f => f.dataType === 'email' && !this._shouldSkip(f.element));
    const nonEmailFields = fields.filter(f => f.dataType !== 'email' && !this._shouldSkip(f.element));
    console.log('FormFiller: nonEmailFields:', nonEmailFields.length, ', emailFields:', emailFields.length);

    // Generate values for all non-email fields first
    for (const field of nonEmailFields) {
      // Skip checkboxes and radios unless they have dv attribute
      if ((field.fieldType === 'checkbox' || field.fieldType === 'radio') && !field.element.hasAttribute('dv')) {
        continue;
      }

      const value = await this.generateValue(field);
      fieldValues[field.element.name || field.element.id] = value;

      // Store for intelligent email generation
      if (field.dataType === 'first') {
        this.fieldData.first = value;
      } else if (field.dataType === 'last') {
        this.fieldData.last = value;
      } else if (field.dataType === 'company') {
        this.fieldData.company = value;
      }
    }

    // Generate email field values last (now that name/company data is available)
    for (const field of emailFields) {
      const value = await this.generateValue(field);
      fieldValues[field.element.name || field.element.id] = value;
    }

    // Fill all fields with generated values
    for (const field of fields) {
      // Skip checkboxes and radios unless they have dv attribute
      if ((field.fieldType === 'checkbox' || field.fieldType === 'radio') && !field.element.hasAttribute('dv')) {
        continue;
      }

      const fieldKey = field.element.name || field.element.id;
      const value = fieldValues[fieldKey];

      // Skip if no value was generated
      if (value === undefined || value === null) {
        continue;
      }

      // Apply safe string filter if enabled
      let finalValue = value;
      if (this.settings.safeStrings && typeof value === 'string') {
        finalValue = this.validators.applySafeStringFilter(value, true);
      }

      // Fill the field
      if (field.type === 'select') {
        field.element.value = finalValue;
      } else {
        field.element.value = finalValue;
      }

      // Dispatch events for form reactivity
      field.element.dispatchEvent(new Event('input', { bubbles: true }));
      field.element.dispatchEvent(new Event('change', { bubbles: true }));
      field.element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    return fields.length;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormFiller;
}
