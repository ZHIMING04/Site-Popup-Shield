# Site Popup Shield

A lightweight, multi-layered Chrome / Edge (Manifest V3) extension designed to block aggressive popups, popunders, and unwanted redirect tabs on any target website — while smoothly allowing normal internal navigation.

---

## 🚀 Quick Setup (Customize for Your Website)

Replace `example.com` with your target domain (e.g. `mysite.com`) in **3 files**:

1. **`manifest.json`**:
   Update `host_permissions` and `matches`:
   ```json
   "host_permissions": ["https://mysite.com/*", "https://*.mysite.com/*"],
   "matches": ["https://mysite.com/*", "https://*.mysite.com/*"]
   ```

2. **`rules.json`**:
   Update `initiatorDomains` and `excludedRequestDomains`:
   ```json
   "initiatorDomains": ["mysite.com"],
   "excludedRequestDomains": ["mysite.com"]
   ```

3. **`background.js`**:
   Update `isProtected()`:
   ```javascript
   return host === 'mysite.com' || host.endsWith('.mysite.com');
   ```

---

## 📦 Installation

1. Open your browser's extension manager:
   - **Chrome**: Navigate to `chrome://extensions`
   - **Edge**: Navigate to `edge://extensions`
2. Turn on **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select this folder.
4. Refresh the target website to activate protection.

---

## 🛡️ Intelligent 3-Layer Defense

| Layer | Component | What it does |
|---|---|---|
| **1. DOM Level** | `popup-guard.js` | Blocks rogue `window.open()` and ad overlays from opening new tabs, while allowing normal clicks and internal same-domain links. |
| **2. Network Level** | `rules.json` | Uses `declarativeNetRequest` to block cross-site frame navigation directly at the browser network layer. |
| **3. Tab Level** | `background.js` | Inspects child tabs: keeps legitimate same-site tabs open, and immediately terminates external ad popups. |

---

## 🔒 Privacy & Security

- **100% Local**: No external scripts, no analytics, no remote tracking.
- **Zero Data Collection**: Does not read, log, or upload your browsing history.
- **Minimal Scope**: Only operates on your configured domain.

---

## 📄 License

MIT
