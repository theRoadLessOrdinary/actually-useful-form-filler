# Installation Guide

## Load the Extension into Chrome

### Step 1: Open Developer Mode
1. Open Chrome
2. Go to `chrome://extensions/`
3. Toggle **Developer mode** (top right corner)

### Step 2: Load the Extension
1. Click **Load unpacked**
2. Navigate to: `/media/william/8TB-DRIVE/www/sites/theroadlessordinary/chrome-extension`
3. Select the folder and click **Open**

### Step 3: Verify Installation
- Extension icon appears in your extension menu
- Settings page opens automatically (optional)
- Navigate to any form and test

## Quick Start

### Method 1: Paint Can Icon (Recommended)
1. Open any web form
2. Look for the **paint can icon** next to the first text field
3. Click the icon
4. All form fields auto-fill with test data ✓

### Method 2: Popup Button
1. Click extension icon → **Fill Form** button
2. Fills all visible form fields on current page

### Method 3: Settings
1. Click extension icon → **Settings**
2. Configure options (safe strings, plausible phones, etc.)
3. Save
4. Use paint can icon or Fill Form button

## Settings Available

### 🔒 String Safety
- Remove vowels, Q, K from random strings
- Prevents accidental profanity in test data

### 📞 Phone Numbers
- Standard: Random 10-digit numbers
- Plausible: Valid FCC area codes and exchanges

### 🗺️ Location Data
- Reconcile ZIP codes with real city/state via API
- 3, 5, or 10 API attempt options
- Fallback: Leave blank or use random data

### 🎨 Paint Can Icon
- Click next to first text field to trigger auto-fill
- Always visible when enabled
- Customizable in settings

## Troubleshooting

### "Could not load manifest"
- Check that all files exist in the directory
- Verify `manifest.json` is valid JSON
- Run: `python3 -m json.tool manifest.json`

### Icons not showing
- Icon files are required (16x16, 48x48, 128x128 PNG)
- They're in `icons/` folder - check they exist

### Form not filling
- Ensure you're on a page with a visible form
- Try clicking "Fill Form" button instead of Konami Code
- Check console (F12) for error messages

### Paint can icon not showing
- Must be enabled in settings (default is on)
- Requires a visible form with at least one text field
- Check extension icon for quick toggle under "Paint can icon"

### ZIP reconciliation not working
- Requires internet connection
- Checking zippopotam.us API
- If API fails, fallback to random or blank (configurable)

## Tips

- **Explicit Control**: Add `dv` attribute to form fields for exact data type:
  ```html
  <input dv="zipcode" name="zip">
  <input dv="email" name="email">
  <select dv="state" name="state">...</select>
  ```

- **Test Different Data**: Each call generates new random data
  - Type Konami Code multiple times to get different datasets
  - Use Fill Form button repeatedly for new data

- **Smart Email**: Extension generates emails intelligently:
  - If form has first name, last name, company → uses those
  - If form has names but no company → uses random company
  - If no names → generates random first initial + last name + company

- **Real Phone Numbers**: Enable "plausible phone numbers" for:
  - Valid area codes (200-899, excluding 555)
  - Valid exchanges (200-999)
  - Valid subscriber numbers (0001-9999, excluding 0000, 1111)


## File Structure

```
chrome-extension/
├── manifest.json              # Configuration
├── background.js              # Service worker
├── content-script.js          # Page injection
├── popup.html / .js           # Quick access
├── settings.html / .js        # Settings page
├── lib/
│   ├── testFormData.json      # 80+ data cases
│   ├── testFormData.js        # Generator
│   ├── validators.js          # Validation logic
│   ├── formFiller.js          # Fill logic
│   └── paintCanInjector.js    # Paint can icon injection
├── icons/                     # Extension icons
├── README.md                  # Documentation
└── INSTALLATION.md            # This file
```

## Support

Check README.md for detailed documentation on:
- How form detection works
- Data generation logic
- Validation rules
- Architecture overview
