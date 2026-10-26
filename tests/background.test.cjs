const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBackground: setup } = require('./helpers/background.cjs');

test('does not subscribe to general tab creation (+ / Ctrl+T)', () => {
  assert.equal(setup().handlers.tabCreated, undefined);
});
test('preserves browser new-tab pages', async () => {
  const app = setup();
  for (const url of ['chrome://newtab/', 'edge://newtab/', 'about:newtab']) await app.navigate(url);
  assert.deepEqual(app.removed, []);
  assert.equal(app.timers.size, 0);
});
test('closes external page-created targets', async () => {
  const app = setup();
  await app.navigate('https://ads.invalid/');
  assert.deepEqual(app.removed, [2]);
});
test('allows page-created same-host tabs', async () => {
  const app = setup();
  await app.navigate('https://example.com/episode');
  assert.deepEqual(app.removed, []);
});
test('ignores unrelated and missing source tabs', async () => {
  const app = setup();
  app.tabs.set(1, { url: 'https://notexample.com/' });
  await app.navigate('https://ads.invalid/');
  app.tabs.delete(1);
  await app.navigate('https://ads.invalid/');
  assert.deepEqual(app.removed, []);
});
test('closes initially blank popups after external navigation', async () => {
  const app = setup();
  await app.navigate('about:blank');
  assert.equal(app.timers.size, 1);
  await app.handlers.updated(2, { url: 'https://ads.invalid/' }, {});
  assert.deepEqual(app.removed, [2]);
  assert.equal(app.timers.size, 0);
});
test('preserves initially blank targets resolved to same-host/browser pages', async () => {
  for (const url of ['https://example.com/episode', 'chrome://newtab/']) {
    const app = setup();
    await app.navigate('about:blank');
    await app.handlers.updated(2, { url }, {});
    assert.deepEqual(app.removed, []);
    assert.equal(app.timers.size, 0);
  }
});
test('closes page-created popups that stay blank', async () => {
  const app = setup();
  app.tabs.set(2, { url: 'about:blank' });
  await app.navigate('about:blank');
  await [...app.timers.values()][0]();
  assert.deepEqual(app.removed, [2]);
});
test('cleans pending timers when popup removed', async () => {
  const app = setup();
  await app.navigate('about:blank');
  app.handlers.removed(2);
  assert.equal(app.timers.size, 0);
});
test('multiple selected sites do not allow popups between each other', async () => {
  const app = setup(['example.com', 'another-site.org']);
  app.tabs.set(1, { url: 'https://another-site.org/watch' });
  await app.navigate('https://another-site.org/episode');
  assert.deepEqual(app.removed, []);
  await app.navigate('https://example.com/episode');
  assert.deepEqual(app.removed, [2]);
});
test('no protection without an enabled site', async () => {
  const app = setup([]);
  await app.navigate('https://ads.invalid/');
  assert.deepEqual(app.removed, []);
});
