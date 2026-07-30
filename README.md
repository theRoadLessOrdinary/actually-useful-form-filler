# Actually Useful Form Filler Chrome Extension

Intelligently fill web forms with realistic test data. Click the paint can icon next to any form field to auto-fill an entire form.

## Screenshot

![Form auto-filled with realistic test data](screenshots/form-fill-demo.png)

## Files Created

### Core Extension Files
- **manifest.json** - Extension configuration (permissions, scripts, icons)
- **background.js** - Service worker for extension initialization
- **content-script.js** - Injects into web pages, sets up form filling and paint can injection
- **popup.html/popup.js** - Quick access popup with quick toggles
- **settings.html/settings.js** - Full settings page with all options

### Library Files (`lib/`)
- **testFormData.json** - 80+ test data cases (names, addresses, emails, etc.)
- **testFormData.js** - Generator class that reads JSON and generates values
- **validators.js** - Validation and generation logic for zipcodes, phones, emails
- **formFiller.js** - Main form detection and filling logic
- **paintCanInjector.js** - Paint can icon injection next to first text field

### Icons (`icons/`)
- Placeholder for extension icons (16x16, 48x48, 128x128)

## Features

### Auto-Detection
Intelligently detects form field types based on:
1. `dv` attribute (explicit, e.g., `dv="zipcode"`)
2. Smart pattern matching on field name/id/aria-label
3. Fallback logic for unknown fields

### Smart Data Generation
- **Names**: First names, last names with proper formatting
- **Email**: Three intelligent modes:
  - With employer: `{initial}{lastname}@{company}.com`
  - Without employer: `{initial}{lastname}@{random-company}.com`
  - No name data: `{random-initial}{random-lastname}@{random-company}.com`
- **Phone**: 
  - Standard: Random format
  - Plausible: Valid FCC area codes (200-899 except 555), exchanges (200-999), subscribers (0001-9999)
- **Address**: Street address, city, state, ZIP
- **ZIP Codes**: 
  - Valid: No leading 00/97/98/99, no sequential, no all-same-digit
  - Optional: Reconcile with zippopotam.us API to match real city/state
- **Other**: Companies, occupations, salaries, dates, etc.

### Settings

**String Safety**
- Remove vowels, Q, K from random character generation (prevents accidental profanity)

**Phone Numbers**
- Generate only valid FCC-compliant phone numbers

**Location Reconciliation**
- Query zippopotam.us API for matching city/state/ZIP
- User-configurable: 3, 5, or 10 API attempts
- Fallback: Leave blank or use random data

**Paint Can Icon**
- Click icon next to first text field to auto-fill form
- Always visible when enabled (default)

## How to Use

### As User
1. Look for the paint can icon next to the first text field on any form
2. Click the icon to auto-fill all visible form fields with test data
3. Form reactivity: change/input/blur events triggered for validation

### As Developer
Add explicit `dv` attribute to form fields for precise control:
```html
<input type="text" dv="zipcode" name="postal_code">
<input type="email" dv="email" name="user_email">
<select dv="state" name="state_code">...</select>
```

## Technical Architecture

### Content Script Flow
1. Page loads → Initialize TestFormDataGenerator
2. Load user settings from chrome.storage.sync
3. Setup PaintCanInjector next to first visible text field
4. When user clicks paint can icon:
   - Scan form fields → Detect data types → Generate values
   - Fill fields → Dispatch change/input/blur events

### Form Filling Logic
1. Find all visible form fields
2. For each field:
   - Check `dv` attribute
   - Try smart detection (name/id/aria patterns)
   - Apply fallback (random company for text, parse options for selects)
3. Generate appropriate test data:
   - Apply settings (safe strings, phone validation)
   - Handle reconciliation for zipcodes
   - Use intelligent templates for emails
4. Fill fields and trigger events

### Validation Rules

**Zipcodes**
- Cannot start with 00, 97, 98, 99
- Cannot be sequential (12345, 54321, etc.)
- Cannot be all same digit (11111, 22222, etc.)

**Phone Numbers (Plausible Mode)**
- NPA (Area Code): 200-899 inclusive, except 555
- NXX (Exchange): 200-999 inclusive
- Subscriber: 0001-9999 inclusive, except 0000 and 1111

## Installation

1. Copy entire `chrome-extension/` directory
2. In Chrome: Settings → Extensions → Developer mode (toggle on)
3. Click "Load unpacked" → Select the directory
4. Icon appears in extension menu

## Settings Storage

Settings saved to `chrome.storage.sync`:
- `safeStrings` (boolean)
- `plausiblePhone` (boolean)
- `reconcile` (boolean)
- `reconcileAttempts` (number: 3, 5, or 10)
- `reconcileFallback` (string: "blank" or "random")
- `konamiEnabled` (boolean)
- `konamiCode` (string)

## Notes

- Checkboxes and radios ignored unless they have `dv` attribute
- Unknown dropdowns: randomly select from available options
- All visible fields filled (hidden fields skipped)
- Form events dispatched: input, change, blur
- Email generation prefers data in order: employer > company > random
- Zipcode reconciliation requires internet access (zippopotam.us)

## License

See [LICENSE](LICENSE). Free to use, copy, modify, and distribute for non-commercial purposes; commercial use requires permission. Provided with no warranty.
