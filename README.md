# Site Popup Shield

A lightweight Chrome / Edge extension that blocks unwanted popups, cookie consent banners, floating video overlays, and ad trackers on websites you choose. No Node.js, build steps, or configuration files needed.

---

## Two Protection Modes

### 1. 🛡️ Standard Protection (Default — Zero Permissions Needed)
When you click **Protect this website**, protection activates **instantly with zero browser security warnings**.
- **Popups & External Redirects**: Background-level monitoring via browser tab navigation closes unwanted popup tabs and external redirects before they open.
- **Speed Boost (Ad & Tracker Blocker)**: Native Declarative Net Request (DNR) blocks ad networks, tracker beacons, and popup scripts at the browser network engine level before downloading.
- **100% Privacy Friendly**: Requires **zero access to your website data**.

### 2. 🍪 Advanced In-Page Cleaning (Optional)
If you want to clean up elements *inside* a specific webpage:
- **Hide Cookie Consent Banners**: Automatically hides GDPR / OneTrust / Cookiebot banners and unfreezes body scrolling.
- **Block Floating Videos & Newsletter Overlays**: Hides sticky corner PIP players and email lead-capture popups.
- *Requires Page Access*: When you toggle on either of these in **Protection options**, the browser will ask for page access permission for that specific website to allow DOM cosmetic cleaning.

---

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` or `edge://extensions` in your browser.
3. Enable **Developer mode** (toggle in top-right corner).
4. Click **Load unpacked** and select this project directory.

## Use

1. Open any website and click the extension icon in the toolbar.
2. Click **Protect this website** (activates Standard Protection instantly with zero permission warnings).
3. Click **Reload** to apply.
4. *(Optional)* Open **Protection options** to enable in-page Cookie Banner or Floating Video cleaning if desired.

> **Tradeoff / Note**: Strict redirect blocking may prevent legitimate external actions (such as third-party SSO logins or external payment portals) from opening. Simply click **Turn off protection** temporarily to complete those actions.

---

### Component Breakdown

| File | Context | Role |
| :--- | :--- | :--- |
| `manifest.json` | Extension Config | Manifest V3 permissions, service worker, and action popup declaration. |
| `background.js` | Service Worker | Manages DNR dynamic rules, tab lifecycle events, and script registration. |
| `site-settings.js` | Shared Module | Normalizes domains, defines tracker lists, and generates DNR & script configs. |
| `popup.html` / `popup.js` / `popup.css` | Extension Popup | Minimalist, zero-scrollbar UI with micro-switches for feature toggles. |
| `cookie-shield.css` | Injected CSS | Instant, zero-flash CSS hiding of OneTrust, Cookiebot, and GDPR consent dialogs. |
| `annoyance-shield.css` | Injected CSS | CSS hiding of corner floating video players and email/newsletter modal overlays. |
| `cosmetic-guard.js` | Content Script | MutationObserver on `html` and `body` to unlock scroll locks (`overflow: hidden`). |
| `popup-guard.js` | Content Script | Runs in `world: MAIN` to wrap `window.open` and intercept external tab links. |

---


## Contributing

Contributions from the community are warmly welcome! Whether you want to improve banner detection, expand tracker blocking, optimize UI/UX, or fix edge-case bugs, your help is appreciated.

- **Add Annoyance & Cookie Selectors**: Add container selectors to `cookie-shield.css` or `annoyance-shield.css`.
- **Expand Tracker & Ad Lists**: Suggest heavy third-party tracking or video ad domains in `site-settings.js`.
- **Edge Cases & Compatibility**: Report sites where legitimate same-domain popups were mistakenly blocked.

---

## License & Privacy

Settings and site lists are stored locally on your device via `chrome.storage.local`. No analytics, no telemetry, and no data uploads.
