'use strict';

function isProtected(url) {
  try {
    if (!url) return false;
    const host = new URL(url).hostname;
    return host === 'example.com' || host.endsWith('.example.com');
  } catch {
    return false;
  }
}

// Track pending tabs that might be suspicious ad popups waiting for destination URL resolution
const pendingTabs = new Map();

chrome.tabs.onCreated.addListener(async tab => {
  if (tab.openerTabId == null) return;

  // Check if the opener tab belongs to the protected site
  let opener;
  try {
    opener = await chrome.tabs.get(tab.openerTabId);
  } catch {
    return;
  }

  if (!opener || !isProtected(opener.url)) return;

  const targetUrl = tab.pendingUrl || tab.url;

  // 1. If targetUrl is already known and is on the protected site, KEEP IT OPEN!
  if (targetUrl && isProtected(targetUrl)) {
    return;
  }

  // 2. If targetUrl is already known to be an external domain, CLOSE IT immediately!
  if (targetUrl && targetUrl !== 'about:blank' && !isProtected(targetUrl)) {
    try {
      await chrome.tabs.remove(tab.id);
    } catch {}
    return;
  }

  // 3. If targetUrl is empty or about:blank, wait briefly for URL resolution.
  // Ad popups that get blocked by declarativeNetRequest or remain blank will be closed.
  const timer = setTimeout(async () => {
    pendingTabs.delete(tab.id);
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      const url = currentTab.pendingUrl || currentTab.url;
      if (!isProtected(url)) {
        await chrome.tabs.remove(tab.id);
      }
    } catch {}
  }, 600);

  pendingTabs.set(tab.id, timer);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!pendingTabs.has(tabId)) return;

  const url = changeInfo.url || tab.pendingUrl || tab.url;
  if (!url || url === 'about:blank') return;

  const timer = pendingTabs.get(tabId);
  clearTimeout(timer);
  pendingTabs.delete(tabId);

  // If destination is internal/protected, KEEP IT!
  if (isProtected(url)) {
    return;
  }

  // If destination is external, CLOSE IT!
  try {
    await chrome.tabs.remove(tabId);
  } catch {}
});

chrome.tabs.onRemoved.addListener(id => {
  if (pendingTabs.has(id)) {
    clearTimeout(pendingTabs.get(id));
    pendingTabs.delete(id);
  }
});
