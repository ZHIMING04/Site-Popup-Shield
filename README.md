# Site Popup Shield

A lightweight, multi-layered Chrome / Edge (Manifest V3) extension designed to block aggressive popups, popunders, and unwanted redirect tabs on any target website.

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

## 🛡️ 3-Layer Defense Mechanism

| Layer | Component | What it does |
|---|---|---|
| **1. DOM Level** | `popup-guard.js` | Disables `window.open()` and cancels click / form events that target new tabs. |
| **2. Network Level** | `rules.json` | Uses `declarativeNetRequest` to block cross-site frame navigation at the browser network layer. |
| **3. Tab Level** | `background.js` | Monitors tab creation and immediately terminates any child tabs spawned by the target site. |

---

## 🔒 Privacy & Security

- **100% Local**: No external scripts, no analytics, no remote tracking.
- **Zero Data Collection**: Does not read, log, or upload your browsing history.
- **Minimal Scope**: Only runs on the specific domain you configure.

---

## 📄 License

MIT
