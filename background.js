'use strict';
importScripts('site-settings.js');
const settings = globalThis.ShieldSettings;
const pendingTabs = new Map();
let sites = [];
let queue = Promise.resolve();

function enqueue(operation) {
  const result = queue.then(operation);
  queue = result.catch(() => {});
  return result;
}

async function permittedSites(candidates) {
  const allowed = [];
  for (const site of candidates) {
    if (await chrome.permissions.contains({ origins: settings.origins(site) })) allowed.push(site);
  }
  return allowed;
}

async function configure(candidates) {
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRules.map(rule => rule.id),
    addRules: settings.rules(candidates),
  });
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const desired = settings.scripts(candidates);
  const desiredIds = new Set(desired.map(script => script.id));
  const stale = registered.filter(script => script.id.startsWith('shield-') && !desiredIds.has(script.id));
  if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale.map(script => script.id) });
  const existing = new Set(registered.map(script => script.id));
  const missing = desired.filter(script => !existing.has(script.id));
  if (missing.length) await chrome.scripting.registerContentScripts(missing);
}

async function saveSites(candidates) {
  const normalized = settings.normalizeSites(candidates);
  const allowed = await permittedSites(normalized);
  const previous = sites;
  try {
    await configure(allowed);
    await chrome.storage.local.set({ protectedSites: allowed });
    sites = allowed;
  } catch (error) {
    try { await configure(previous); }
    catch (rollbackError) { console.error('[Popup Shield] Could not restore protection:', rollbackError); }
    throw error;
  }
  for (const [tabId, pending] of pendingTabs) {
    if (!sites.includes(pending.sourceHost)) clearPending(tabId);
  }
  return sites;
}

const ready = enqueue(async () => {
  const stored = await chrome.storage.local.get({ protectedSites: [] });
  await saveSites(stored.protectedSites);
});
ready.catch(error => console.error('[Popup Shield] Initialization failed:', error));

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  if (!['getState', 'enableSite', 'disableSite'].includes(message?.type)) return;
  enqueue(async () => {
    await ready;
    if (message.type === 'enableSite') {
      const [host] = settings.normalizeSites([message.hostname]);
      if (!(await chrome.permissions.contains({ origins: settings.origins(host) }))) {
        throw new Error('Website access was not granted. Please try enabling protection again.');
      }
      await saveSites([...sites, host]);
    }
    if (message.type === 'disableSite') {
      const [host] = settings.normalizeSites([message.hostname]);
      await saveSites(sites.filter(site => site !== host));
      await chrome.permissions.remove({ origins: settings.origins(host) });
    }
    return { ok: true, sites };
  }).then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});

chrome.permissions.onRemoved.addListener(() => {
  enqueue(() => saveSites(sites)).catch(error => console.error('[Popup Shield] Could not sync permissions:', error));
});

function isBrowserPage(url) {
  try {
    const protocol = new URL(url).protocol;
    return ['chrome:', 'chrome-search:', 'chrome-extension:', 'edge:', 'edge-search:'].includes(protocol)
      || url === 'about:newtab' || url === 'about:home';
  } catch { return false; }
}
function sameHost(url, host) { return settings.hostname(url) === host; }
function clearPending(tabId) {
  const pending = pendingTabs.get(tabId);
  if (pending) clearTimeout(pending.timer);
  pendingTabs.delete(tabId);
}
async function closeTab(tabId) {
  try { await chrome.tabs.remove(tabId); } catch {}
}

// Browser UI + / Ctrl+T tabs do not emit this page-navigation event.
chrome.webNavigation.onCreatedNavigationTarget.addListener(async details => {
  await ready;
  if (details.sourceTabId < 0 || details.sourceTabId === details.tabId || isBrowserPage(details.url)) return;
  let opener;
  try { opener = await chrome.tabs.get(details.sourceTabId); } catch { return; }
  const sourceHost = settings.hostname(opener.url);
  if (!sites.includes(sourceHost)) return;
  const tabId = details.tabId;
  clearPending(tabId);
  if (sameHost(details.url, sourceHost)) return;
  if (details.url && details.url !== 'about:blank') {
    await closeTab(tabId);
    return;
  }
  const timer = setTimeout(async () => {
    pendingTabs.delete(tabId);
    if (!sites.includes(sourceHost)) return;
    try {
      const tab = await chrome.tabs.get(tabId);
      const url = tab.pendingUrl || tab.url;
      if (!sameHost(url, sourceHost) && !isBrowserPage(url)) await closeTab(tabId);
    } catch {}
  }, 600);
  pendingTabs.set(tabId, { timer, sourceHost });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const pending = pendingTabs.get(tabId);
  if (!pending) return;
  if (!sites.includes(pending.sourceHost)) { clearPending(tabId); return; }
  const url = changeInfo.url || tab.pendingUrl || tab.url;
  if (!url || url === 'about:blank') return;
  clearPending(tabId);
  if (!sameHost(url, pending.sourceHost) && !isBrowserPage(url)) await closeTab(tabId);
});
chrome.tabs.onRemoved.addListener(clearPending);
