const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createBackground } = require('./helpers/background.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const context = vm.createContext({ URL });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'site-settings.js'), 'utf8'), context);
const settings = context.ShieldSettings;

test('recognizes only supported website URLs and normalizes hostnames', () => {
  assert.equal(settings.hostname('https://WWW.Example.com/watch'), 'www.example.com');
  assert.equal(settings.hostname('chrome://extensions'), null);
  assert.equal(settings.hostname('file:///secret'), null);
  assert.equal(settings.hostname('javascript:alert(1)'), null);
  for (const value of ['example.com/path', '*.example.com', 'example.com:443', 'https://example.com', '__proto__']) {
    assert.throws(() => settings.normalizeSites([value]));
  }
});
test('generates independent rules and persistent scripts for multiple websites', () => {
  const sites = ['example.com', 'other.org'];
  const rules = settings.rules(sites), scripts = settings.scripts(sites);
  assert.equal(rules.length, 2);
  assert.deepEqual(plain(rules[0].condition.initiatorDomains), ['example.com']);
  assert.deepEqual(plain(rules[0].condition.excludedRequestDomains), ['example.com']);
  assert.deepEqual(plain(scripts[1].matches), ['*://other.org/*']);
  assert.equal(scripts[1].world, 'MAIN');
  assert.equal(scripts[1].persistAcrossSessions, true);
});
test('starts with no websites, no scripts and no rules on fresh install', async () => {
  const app = createBackground([]);
  const result = await app.message({ type: 'getState' });
  assert.deepEqual(plain(result), { ok: true, sites: [] });
  assert.equal(app.rules().length, 0);
  assert.equal(app.scripts().length, 0);
});
test('enables a permitted website and persists its rules and script', async () => {
  const app = createBackground([]);
  app.grants.add('example.com');
  const result = await app.message({ type: 'enableSite', hostname: 'example.com' });
  assert.deepEqual(plain(result.sites), ['example.com']);
  assert.deepEqual(plain(app.storage.protectedSites), ['example.com']);
  assert.equal(app.rules().length, 1);
  assert.equal(app.scripts()[0].id, 'shield-example.com');
});
test('denied permission leaves the website disabled', async () => {
  const app = createBackground([]);
  const result = await app.message({ type: 'enableSite', hostname: 'example.com' });
  assert.equal(result.ok, false);
  assert.deepEqual(plain(app.storage.protectedSites), []);
  assert.equal(app.rules().length, 0);
});
test('disabling clears rules, scripts, permission and pending popup timers', async () => {
  const app = createBackground();
  await app.navigate('about:blank');
  const result = await app.message({ type: 'disableSite', hostname: 'example.com' });
  assert.equal(result.ok, true);
  assert.equal(app.rules().length, 0);
  assert.equal(app.scripts().length, 0);
  assert.equal(app.timers.size, 0);
  assert.equal(app.grants.has('example.com'), false);
  await app.navigate('https://ads.invalid/');
  assert.deepEqual(app.removed, []);
});
test('saved websites restore after worker startup', async () => {
  const app = createBackground(['example.com', 'other.org']);
  const result = await app.message({ type: 'getState' });
  assert.deepEqual(plain(result.sites), ['example.com', 'other.org']);
  assert.equal(app.rules().length, 2);
  assert.equal(app.scripts().length, 2);
});
test('browser-side permission revocation removes protection', async () => {
  const app = createBackground();
  await app.message({ type: 'getState' });
  app.grants.delete('example.com');
  app.handlers.permissionsRemoved();
  const result = await app.message({ type: 'getState' });
  assert.deepEqual(plain(result.sites), []);
  assert.equal(app.rules().length, 0);
  assert.equal(app.scripts().length, 0);
});
test('failed script registration rolls back rules and does not save the site', async () => {
  const app = createBackground();
  await app.message({ type: 'getState' });
  app.grants.add('other.org');
  app.failNextRegistration();
  const result = await app.message({ type: 'enableSite', hostname: 'other.org' });
  assert.equal(result.ok, false);
  assert.deepEqual(plain(app.storage.protectedSites), ['example.com']);
  assert.equal(app.rules().length, 1);
  assert.equal(app.scripts().length, 1);
});
test('concurrent site changes are serialized without losing either website', async () => {
  const app = createBackground([]);
  app.grants.add('example.com'); app.grants.add('other.org');
  await Promise.all([
    app.message({ type: 'enableSite', hostname: 'example.com' }),
    app.message({ type: 'enableSite', hostname: 'other.org' }),
  ]);
  assert.deepEqual(plain(app.storage.protectedSites), ['example.com', 'other.org']);
});
test('web pages cannot send privileged configuration messages', async () => {
  const app = createBackground([]);
  const result = await app.message({ type: 'enableSite', hostname: 'example.com' }, { id: 'test-extension', url: 'https://example.com/' });
  assert.equal(result, undefined);
});
test('manifest needs no fixed website list or build step', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.declarative_net_request, undefined);
  assert(manifest.permissions.includes('storage'));
  assert(manifest.permissions.includes('scripting'));
  assert(!manifest.permissions.includes('tabs'));
});
