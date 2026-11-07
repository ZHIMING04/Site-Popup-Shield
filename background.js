'use strict';
importScripts('site-settings.js');
const settings = globalThis.ShieldSettings;
const pendingTabs = new Map();
const tabHosts = new Map();
let sites = [];
let siteOptions = {};
let queue = Promise.resolve();

function enqueue(operation) {
  const result = queue.then(operation);
  queue = result.catch(() => {});
  return result;
}

async function permittedOriginSites(candidates) {
  const allowed = [];
  for (const site of candidates) {
    try {
      if (await chrome.permissions.contains({ origins: settings.origins(site) })) {
        allowed.push(site);
      }
    } catch {}
  }
  return allowed;
}

async function configure(candidates, options = siteOptions) {
  // Declarative Net Request runs in browser network engine without needing host permissions
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRules.map(rule => rule.id),
    addRules: settings.rules(candidates, options),
  });

  // Content scripts (in-page DOM manipulation) require origin permissions
  const originSites = await permittedOriginSites(candidates);
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const desired = settings.scripts(originSites, options);

  const existingShieldIds = registered.filter(script => script.id.startsWith('shield-')).map(script => script.id);
  if (existingShieldIds.length) {
    await chrome.scripting.unregisterContentScripts({ ids: existingShieldIds });
  }
  if (desired.length) {
    await chrome.scripting.registerContentScripts(desired);
  }
}

async function saveSites(candidates, options = siteOptions) {
  const normalized = settings.normalizeSites(candidates);
  const previousSites = sites;
  const previousOptions = siteOptions;

  const cleanedOptions = {};
  for (const site of normalized) {
    cleanedOptions[site] = settings.getOptions(site, options);
  }

  try {
    await configure(normalized, cleanedOptions);
    await chrome.storage.local.set({ protectedSites: normalized, siteOptions: cleanedOptions });
    sites = normalized;
    siteOptions = cleanedOptions;
  } catch (error) {
    try { await configure(previousSites, previousOptions); }
    catch (rollbackError) { console.error('[Popup Shield] Could not restore protection:', rollbackError); }
    throw error;
  }

  for (const [tabId, pending] of pendingTabs) {
    if (!sites.includes(pending.sourceHost) || !settings.getOptions(pending.sourceHost, siteOptions).popups) {
      clearPending(tabId);
    }
  }
  return { sites, siteOptions };
}

const ready = enqueue(async () => {
  const stored = await chrome.storage.local.get({ protectedSites: [], siteOptions: {} });
  siteOptions = stored.siteOptions || {};
  await saveSites(stored.protectedSites, siteOptions);

  // Initialize in-memory tab hosts cache for fast synchronous lookup
  try {
    const currentTabs = await chrome.tabs.query({});
    for (const t of currentTabs) {
      const host = settings.hostname(t.url || t.pendingUrl);
      if (host) tabHosts.set(t.id, host);
    }
  } catch {}
});
ready.catch(error => console.error('[Popup Shield] Initialization failed:', error));

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  if (!['getState', 'enableSite', 'disableSite', 'updateSiteOptions'].includes(message?.type)) return;
  enqueue(async () => {
    await ready;
    if (message.type === 'enableSite') {
      const [host] = settings.normalizeSites([message.hostname]);
      siteOptions[host] = settings.getOptions(host, siteOptions);
      const nextSites = [...sites.filter(s => s !== host), host];
      await saveSites(nextSites, siteOptions);
    }
    if (message.type === 'disableSite') {
      const [host] = settings.normalizeSites([message.hostname]);
      const nextSites = sites.filter(site => site !== host);
      delete siteOptions[host];
      await saveSites(nextSites, siteOptions);
      try {
        if (await chrome.permissions.contains({ origins: settings.origins(host) })) {
          await chrome.permissions.remove({ origins: settings.origins(host) });
        }
      } catch {}
    }
    if (message.type === 'updateSiteOptions') {
      const [host] = settings.normalizeSites([message.hostname]);
      if (sites.includes(host) && message.options) {
        siteOptions[host] = settings.getOptions(host, { [host]: message.options });
        await saveSites(sites, siteOptions);
      }
    }
    return { ok: true, sites, siteOptions };
  }).then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});

chrome.permissions.onRemoved.addListener(() => {
  enqueue(() => saveSites(sites, siteOptions)).catch(error => console.error('[Popup Shield] Could not sync permissions:', error));
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

async function getOpenerHost(openerTabId) {
  if (!openerTabId) return null;
  const cached = tabHosts.get(openerTabId);
  if (cached) return cached;
  try {
    const opener = await chrome.tabs.get(openerTabId);
    const host = settings.hostname(opener.url || opener.pendingUrl);
    if (host) tabHosts.set(openerTabId, host);
    return host;
  } catch {
    return null;
  }
}

// 1. FAST-PATH: Intercept tab creation at the earliest microtask before rendering
chrome.tabs.onCreated.addListener(async tab => {
  if (!tab.openerTabId || tab.openerTabId === tab.id) return;
  const sourceHost = await getOpenerHost(tab.openerTabId);
  if (!sourceHost || !sites.includes(sourceHost) || !settings.getOptions(sourceHost, siteOptions).popups) return;

  const targetUrl = tab.pendingUrl || tab.url;

  // KEY FIX: Instantly pin focus to the opener tab so the browser never switches visual focus (no flash)
  if (tab.active) {
    try { await chrome.tabs.update(tab.openerTabId, { active: true }); } catch {}
  }

  // If destination is already an external site, close it immediately before it paints
  if (targetUrl && !isBrowserPage(targetUrl)) {
    if (!sameHost(targetUrl, sourceHost)) {
      await closeTab(tab.id);
      return;
    }
  }

  // If blank, hold pending with aggressive 100ms timeout
  const timer = setTimeout(async () => {
    pendingTabs.delete(tab.id);
    if (!sites.includes(sourceHost) || !settings.getOptions(sourceHost, siteOptions).popups) return;
    try {
      const cur = await chrome.tabs.get(tab.id);
      const curUrl = cur.pendingUrl || cur.url;
      if (!sameHost(curUrl, sourceHost) && !isBrowserPage(curUrl)) {
        await closeTab(tab.id);
      }
    } catch {}
  }, 100);

  pendingTabs.set(tab.id, { timer, sourceHost });
});

// 2. BACKUP-PATH: WebNavigation event for navigation-triggered targets
chrome.webNavigation.onCreatedNavigationTarget.addListener(async details => {
  if (details.sourceTabId < 0 || details.sourceTabId === details.tabId || isBrowserPage(details.url)) return;
  const sourceHost = await getOpenerHost(details.sourceTabId);
  if (!sourceHost || !sites.includes(sourceHost) || !settings.getOptions(sourceHost, siteOptions).popups) return;

  const tabId = details.tabId;
  clearPending(tabId);

  // Allow same-domain navigation
  if (sameHost(details.url, sourceHost)) return;

  // External target navigation -> close tab immediately and keep opener tab active
  if (details.url && details.url !== 'about:blank') {
    try { await chrome.tabs.update(details.sourceTabId, { active: true }); } catch {}
    await closeTab(tabId);
    return;
  }

  const timer = setTimeout(async () => {
    pendingTabs.delete(tabId);
    if (!sites.includes(sourceHost) || !settings.getOptions(sourceHost, siteOptions).popups) return;
    try {
      const tab = await chrome.tabs.get(tabId);
      const url = tab.pendingUrl || tab.url;
      if (!sameHost(url, sourceHost) && !isBrowserPage(url)) {
        try { await chrome.tabs.update(details.sourceTabId, { active: true }); } catch {}
        await closeTab(tabId);
      }
    } catch {}
  }, 100);

  pendingTabs.set(tabId, { timer, sourceHost });
});

// 3. Keep cache updated & track pending blank tab resolutions
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url || tab.pendingUrl;
  if (url) {
    const host = settings.hostname(url);
    if (host) tabHosts.set(tabId, host);
    else tabHosts.delete(tabId);
  }

  const pending = pendingTabs.get(tabId);
  if (!pending) return;
  if (!sites.includes(pending.sourceHost) || !settings.getOptions(pending.sourceHost, siteOptions).popups) {
    clearPending(tabId);
    return;
  }

  if (!url || url === 'about:blank') return;
  clearPending(tabId);

  if (!sameHost(url, pending.sourceHost) && !isBrowserPage(url)) {
    await closeTab(tabId);
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabHosts.delete(tabId);
  clearPending(tabId);
});
