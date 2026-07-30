/**
 * Validators and Generators
 * Zipcode, phone, email validation and generation
 */

class Validators {
  /**
   * Check if a zipcode is valid (US rules)
   */
  static isValidZipcode(zip) {
    const zipStr = String(zip).padStart(5, '0');

    // Cannot be less than 5 digits
    if (zipStr.length !== 5) return false;

    // Cannot start with 00, 97, 98, 99
    const first2 = zipStr.substring(0, 2);
    if (['00', '97', '98', '99'].includes(first2)) return false;

    // Cannot be sequential (like 12345, 54321)
    if (this._isSequential(zipStr)) return false;

    // Cannot be all same digit (like 11111, 22222)
    if (this._isSameDigit(zipStr)) return false;

    return true;
  }

  /**
   * Check if string is sequential
   */
  static _isSequential(str) {
    const digits = str.split('').map(Number);
    const forward = digits.every((d, idx) => idx === 0 || d === digits[idx - 1] + 1);
    const backward = digits.every((d, idx) => idx === 0 || d === digits[idx - 1] - 1);
    return forward || backward;
  }

  /**
   * Check if all digits are the same
   */
  static _isSameDigit(str) {
    const first = str[0];
    return str.split('').every(c => c === first);
  }

  /**
   * Generate a valid US zipcode
   */
  static generateValidZipcode() {
    let attempts = 0;
    while (attempts < 100) {
      const zip = Math.floor(Math.random() * 99000) + 1000;
      if (this.isValidZipcode(zip)) {
        return String(zip).padStart(5, '0');
      }
      attempts++;
    }
    return '10001'; // Fallback to known valid zip
  }

  /**
   * Query zippopotam API for city/state
   */
  static async queryZippopotamAPI(zipcode) {
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zipcode}`);
      if (!response.ok) return null;

      const data = await response.json();
      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        return {
          city: place['place name'],
          state: place['state abbreviation'],
          zipcode: zipcode
        };
      }
    } catch (error) {
      console.warn('Zippopotam API error:', error);
    }
    return null;
  }

  /**
   * Generate reconciled zipcode/city/state
   */
  static async generateReconciled(maxAttempts = 5) {
    for (let i = 0; i < maxAttempts; i++) {
      const zip = this.generateValidZipcode();
      const result = await this.queryZippopotamAPI(zip);
      if (result) return result;
    }
    return null;
  }

  /**
   * Check if phone number is valid (FCC rules)
   */
  static isPlausiblePhone(phone) {
    // Remove non-digits
    const digits = phone.replace(/\D/g, '');

    if (digits.length !== 10) return false;

    const npa = parseInt(digits.substring(0, 3));
    const nxx = parseInt(digits.substring(3, 6));
    const subscriber = parseInt(digits.substring(6));

    // NPA: 200-899 except 555
    if (npa < 200 || npa > 899 || npa === 555) return false;

    // NXX: 200-999
    if (nxx < 200 || nxx > 999) return false;

    // Subscriber: 0001-9999 except 0000, 1111
    if (subscriber === 0 || subscriber === 1111) return false;

    return true;
  }

  /**
   * Generate a plausible US phone number
   */
  static generatePlausiblePhone() {
    let npa, nxx, subscriber;

    // NPA: 200-899 except 555
    do {
      npa = Math.floor(Math.random() * 700) + 200; // 200-899
    } while (npa === 555);

    // NXX: 200-999
    nxx = Math.floor(Math.random() * 800) + 200;

    // Subscriber: 0001-9999 except 0000, 1111
    do {
      subscriber = Math.floor(Math.random() * 10000);
    } while (subscriber === 0 || subscriber === 1111);

    return `${String(npa).padStart(3, '0')}-${String(nxx).padStart(3, '0')}-${String(subscriber).padStart(4, '0')}`;
  }

  /**
   * Generate email intelligently based on available data
   */
  static generateEmail(firstName = null, lastName = null, employerName = null) {
    // Case 1: Has first, last, and employer
    if (firstName && lastName && employerName) {
      const domain = employerName.toLowerCase().replace(/\s+/g, '');
      return `${firstName[0].toLowerCase()}${lastName.toLowerCase()}@${domain}.com`;
    }

    // Case 2: Has first and last (but no employer)
    if (firstName && lastName) {
      // Use random company from list
      const companies = ['google', 'microsoft', 'apple', 'amazon', 'intel', 'ibm', 'oracle', 'salesforce', 'adobe', 'cisco'];
      const company = companies[Math.floor(Math.random() * companies.length)];
      return `${firstName[0].toLowerCase()}${lastName.toLowerCase()}@${company}.com`;
    }

    // Case 3: No last name or no name data
    const lastNames = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez'];
    const companies = ['google', 'microsoft', 'apple', 'amazon', 'intel', 'ibm', 'oracle', 'salesforce', 'adobe', 'cisco'];

    const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randomCompany = companies[Math.floor(Math.random() * companies.length)];
    const randomInitial = String.fromCharCode(65 + Math.floor(Math.random() * 26)).toLowerCase();

    return `${randomInitial}${randomLast}@${randomCompany}.com`;
  }

  /**
   * Apply safe string filter (remove vowels, Q, K)
   */
  static applySafeStringFilter(str, enabled = false) {
    if (!enabled) return str;

    const unsafe = /[aeiouqkAEIOUQK]/g;
    return str.replace(unsafe, '');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Validators;
}
