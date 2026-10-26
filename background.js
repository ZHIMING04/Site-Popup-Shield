'use strict';

const descendants = new Set();

function isProtected(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'example.com' || host.endsWith('.example.com');
  } catch {
    return false;
  }
}

chrome.tabs.onCreated.addListener(async tab => {
  if (tab.openerTabId == null) return;

  // Record descendants immediately after verifying their opener, then close them.
  let close = descendants.has(tab.openerTabId);
  if (!close) {
    try {
      close = isProtected((await chrome.tabs.get(tab.openerTabId)).url);
    } catch {
      return;
    }
  }

  if (!close) return;

  descendants.add(tab.id);
  try {
    await chrome.tabs.remove(tab.id);
  } catch {
    descendants.delete(tab.id);
  }
});

chrome.tabs.onRemoved.addListener(id => descendants.delete(id));
