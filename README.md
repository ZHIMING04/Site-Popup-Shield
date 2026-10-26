# Site Popup Shield

A small Chrome / Edge extension that blocks unwanted popups on websites you choose. No Node.js or configuration files needed.

## Install

1. Download and extract this project.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this folder.

## Use

1. Open a website and click the extension icon (pin it to the toolbar if needed).
2. Click **Protect this website** and approve access to that website.
3. Click **Refresh this page to apply** when ready.

Use **Turn off for this website** or **Remove** in the protected websites list to stop protection. Refresh any open pages of that website to remove the page-level guard. Multiple websites can be managed separately; settings persist on this device.

## What to expect

- Browser **+** and **Ctrl+T** still work.
- Page-opened same-host tabs are allowed; external or blank popup attempts are blocked or closed.
- Websites are selected by the hostname displayed in the popup. Add other hostnames separately as needed.
- Browser network domain rules also cover subdomains of the selected hostname.
- Normal external links and cross-site redirects may also be blocked. Some popup techniques can escape detection; closing a tab does not guarantee that no request has already been made.

## Privacy

The extension requests website access when you enable protection. It reads tab URLs locally to apply rules and stores only your protected website list. No analytics or data uploads.
