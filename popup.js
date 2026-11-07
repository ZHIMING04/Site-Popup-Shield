'use strict';
const settings = globalThis.ShieldSettings;
const toggle = document.getElementById('toggle');
const siteHeading = document.getElementById('site-heading');
const status = document.getElementById('status');
const statusDot = document.getElementById('status-dot');
const modeBadge = document.getElementById('mode-badge');
const siteCountPill = document.getElementById('site-count-pill');
const list = document.getElementById('sites');
const count = document.getElementById('count');
const empty = document.getElementById('empty');
const feedback = document.getElementById('feedback');
const reloadBanner = document.getElementById('reload-banner');
const refresh = document.getElementById('refresh');

const featuresDetails = document.getElementById('features-details');

const featurePopups = document.getElementById('feature-popups');
const featureCookies = document.getElementById('feature-cookies');
const featureAnnoyances = document.getElementById('feature-annoyances');
const featureSpeed = document.getElementById('feature-speed');

let currentTab;
let currentHost;
let sites = [];
let siteOptions = {};
let busy = true;

function notify(message, error = false) {
  feedback.textContent = message;
  feedback.classList.toggle('error', error);
  feedback.hidden = false;
}

async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Could not update protection.');
  sites = result.sites || [];
  siteOptions = result.siteOptions || {};
  return result;
}

function render() {
  const enabled = Boolean(currentHost && sites.includes(currentHost));
  siteHeading.textContent = currentHost || 'No website open';
  status.textContent = currentHost ? (enabled ? 'Protected' : 'Not protected') : 'Unavailable';
  statusDot.className = currentHost ? (enabled ? 'status-dot active' : 'status-dot') : 'status-dot';
  
  toggle.classList.toggle('enabled', enabled);
  toggle.textContent = busy ? 'Please wait…' : (enabled ? 'Turn off protection' : 'Protect this website');
  toggle.disabled = busy || !currentHost;

  if (enabled && currentHost) {
    featuresDetails.hidden = false;

    const opts = settings.getOptions(currentHost, siteOptions);
    featurePopups.checked = Boolean(opts.popups);
    featureCookies.checked = Boolean(opts.cookies);
    featureAnnoyances.checked = Boolean(opts.annoyances);
    featureSpeed.checked = Boolean(opts.speed);

    const isAdvanced = Boolean(opts.cookies || opts.annoyances);
    modeBadge.textContent = isAdvanced ? 'Advanced' : 'Standard';
    modeBadge.title = isAdvanced ? 'Advanced: In-page banner & overlay cleaner active' : 'Standard: Popups & ad networks blocked (Zero data access)';
    modeBadge.hidden = false;
  } else {
    featuresDetails.hidden = true;
    modeBadge.hidden = true;
  }

  siteCountPill.textContent = `${sites.length} protected`;
  count.textContent = String(sites.length);
  empty.hidden = sites.length > 0;
  
  list.replaceChildren();
  for (const hostname of sites) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = hostname;
    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove protection for ${hostname}`);
    remove.disabled = busy;
    remove.addEventListener('click', () => disable(hostname));
    item.append(label, remove);
    list.append(item);
  }
}

async function updateFeatures(event) {
  if (!currentHost || !sites.includes(currentHost)) return;

  const targetCheckbox = event?.target;
  const isRequestingInPage = targetCheckbox === featureCookies || targetCheckbox === featureAnnoyances;

  // If user is enabling an in-page feature, request origin permission only now
  if (isRequestingInPage && targetCheckbox.checked) {
    try {
      const hasPermission = await chrome.permissions.contains({ origins: settings.origins(currentHost) });
      if (!hasPermission) {
        const granted = await chrome.permissions.request({ origins: settings.origins(currentHost) });
        if (!granted) {
          targetCheckbox.checked = false;
          notify('In-page cleaning requires page permission. Standard protection remains active.');
          return;
        }
      }
    } catch {
      targetCheckbox.checked = false;
      return;
    }
  }

  const updated = {
    popups: featurePopups.checked,
    cookies: featureCookies.checked,
    annoyances: featureAnnoyances.checked,
    speed: featureSpeed.checked
  };

  siteOptions[currentHost] = updated;

  const isAdvanced = Boolean(updated.cookies || updated.annoyances);
  modeBadge.textContent = isAdvanced ? 'Advanced' : 'Standard';

  try {
    await request({ type: 'updateSiteOptions', hostname: currentHost, options: updated });
    reloadBanner.hidden = false;
  } catch (error) {
    notify(error.message, true);
    render();
  }
}

for (const checkbox of [featurePopups, featureCookies, featureAnnoyances, featureSpeed]) {
  checkbox.addEventListener('change', updateFeatures);
}

async function disable(hostname) {
  if (busy) return;
  busy = true;
  toggle.disabled = true;
  render();
  try {
    await request({ type: 'disableSite', hostname });
    if (hostname === currentHost) reloadBanner.hidden = false;
  } catch (error) {
    notify(error.message, true);
  } finally {
    busy = false;
    render();
  }
}

toggle.addEventListener('click', async () => {
  if (busy || !currentHost) return;
  if (sites.includes(currentHost)) {
    await disable(currentHost);
    return;
  }
  busy = true;
  toggle.disabled = true;
  render();
  try {
    // Standard mode: Enable instantly without asking for any host permissions!
    await request({ type: 'enableSite', hostname: currentHost });
    reloadBanner.hidden = false;
  } catch (error) {
    notify(error.message, true);
  } finally {
    busy = false;
    render();
  }
});

refresh.addEventListener('click', async () => {
  try {
    await chrome.tabs.reload(currentTab.id);
    window.close();
  } catch (error) {
    notify(error.message, true);
  }
});

async function initialize() {
  try {
    [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentHost = settings.hostname(currentTab?.url);
    if (['chromewebstore.google.com', 'chrome.google.com', 'microsoftedge.microsoft.com'].includes(currentHost)) {
      currentHost = null;
    }
    await request({ type: 'getState' });
  } catch (error) {
    notify(error.message, true);
  } finally {
    busy = false;
    render();
  }
}
initialize();
