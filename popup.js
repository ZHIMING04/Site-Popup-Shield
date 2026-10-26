'use strict';
const settings = globalThis.ShieldSettings;
const toggle = document.getElementById('toggle');
const siteHeading = document.getElementById('site-heading');
const status = document.getElementById('status');
const list = document.getElementById('sites');
const feedback = document.getElementById('feedback');
const refresh = document.getElementById('refresh');
let currentTab;
let currentHost;
let sites = [];
let busy = true;

function notify(message, error = false) {
  feedback.textContent = message;
  feedback.classList.toggle('error', error);
  feedback.hidden = false;
}

async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Could not update protection. Please try again.');
  sites = result.sites;
}

function render() {
  const enabled = sites.includes(currentHost);
  siteHeading.textContent = currentHost || 'Open a website first';
  status.textContent = currentHost ? (enabled ? 'Protection on' : 'Protection off') : 'Not available on this page';
  status.classList.toggle('active', enabled);
  toggle.classList.toggle('enabled', enabled);
  toggle.textContent = busy ? 'Please wait…' : (enabled ? 'Turn off for this website' : 'Protect this website');
  toggle.disabled = busy || !currentHost;
  document.getElementById('count').textContent = String(sites.length);
  document.getElementById('empty').hidden = sites.length > 0;
  list.replaceChildren();
  for (const hostname of sites) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = hostname;
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove protection for ${hostname}`);
    remove.disabled = busy;
    remove.addEventListener('click', () => disable(hostname));
    item.append(label, remove);
    list.append(item);
  }
}

async function disable(hostname) {
  if (busy) return;
  busy = true;
  render();
  try {
    await request({ type: 'disableSite', hostname });
    notify('Protection turned off. Refresh any open pages of this website to finish.');
    if (hostname === currentHost) refresh.hidden = false;
  } catch (error) { notify(error.message, true); }
  finally { busy = false; render(); }
}

toggle.addEventListener('click', async () => {
  if (busy || !currentHost) return;
  if (sites.includes(currentHost)) { await disable(currentHost); return; }
  busy = true;
  render();
  try {
    // Must be invoked directly from the click, before any other asynchronous work.
    const granted = await chrome.permissions.request({ origins: settings.origins(currentHost) });
    if (!granted) { notify('Website access was not granted. Protection remains off.'); return; }
    await request({ type: 'enableSite', hostname: currentHost });
    notify('Website added. Refresh this page to activate all protection.');
    refresh.hidden = false;
  } catch (error) { notify(error.message, true); }
  finally { busy = false; render(); }
});

refresh.addEventListener('click', async () => {
  try { await chrome.tabs.reload(currentTab.id); window.close(); }
  catch (error) { notify(error.message, true); }
});

async function initialize() {
  try {
    [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentHost = settings.hostname(currentTab?.url);
    // The browser's extension stores do not permit script injection.
    if (['chromewebstore.google.com', 'chrome.google.com', 'microsoftedge.microsoft.com'].includes(currentHost)) currentHost = null;
    await request({ type: 'getState' });
    if (currentHost && sites.includes(currentHost)) refresh.hidden = false;
  } catch (error) { notify(error.message, true); }
  finally { busy = false; render(); }
}
initialize();
