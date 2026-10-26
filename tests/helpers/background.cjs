const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..', '..');

function createBackground(initialSites = ['example.com']) {
  const handlers = {}, removed = [], timers = new Map();
  const tabs = new Map([[1, { url: 'https://example.com/watch' }]]);
  const grants = new Set(initialSites);
  const storage = { protectedSites: [...initialSites] };
  let registered = [], rules = [], timerId = 0, failRegistration = false;
  const event = name => ({ addListener: fn => { handlers[name] = fn; } });
  const context = vm.createContext({
    URL, console,
    importScripts(...files) {
      for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    chrome: {
      storage: { local: {
        async get() { return { ...storage }; },
        async set(values) { Object.assign(storage, values); },
      } },
      permissions: {
        onRemoved: event('permissionsRemoved'),
        async contains({ origins }) { return origins.every(origin => grants.has(new URL(origin).hostname)); },
        async remove({ origins }) {
          for (const origin of origins) grants.delete(new URL(origin).hostname);
          handlers.permissionsRemoved();
          return true;
        },
      },
      scripting: {
        async getRegisteredContentScripts() { return registered; },
        async unregisterContentScripts({ ids }) { registered = registered.filter(item => !ids.includes(item.id)); },
        async registerContentScripts(scripts) {
          if (failRegistration) { failRegistration = false; throw Error('Registration failed'); }
          registered.push(...scripts);
        },
      },
      declarativeNetRequest: {
        async getDynamicRules() { return rules; },
        async updateDynamicRules({ removeRuleIds, addRules }) {
          rules = rules.filter(rule => !removeRuleIds.includes(rule.id)).concat(addRules);
        },
      },
      runtime: { id: 'test-extension', getURL: value => `chrome-extension://test-extension/${value}`, onMessage: event('message') },
      webNavigation: { onCreatedNavigationTarget: event('navigation') },
      tabs: {
        onCreated: event('tabCreated'), onUpdated: event('updated'), onRemoved: event('removed'),
        async get(id) { if (!tabs.has(id)) throw Error('Missing tab'); return tabs.get(id); },
        async remove(id) { removed.push(id); },
      },
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), context);
  const message = (data, sender = { id: 'test-extension', url: 'chrome-extension://test-extension/popup.html' }) =>
    new Promise(resolve => { const result = handlers.message(data, sender, resolve); if (result !== true) resolve(undefined); });
  return {
    handlers, removed, timers, tabs, grants, storage, message,
    rules: () => rules, scripts: () => registered,
    failNextRegistration() { failRegistration = true; },
    navigate: url => handlers.navigation({ sourceTabId: 1, tabId: 2, url }),
  };
}
module.exports = { createBackground };
