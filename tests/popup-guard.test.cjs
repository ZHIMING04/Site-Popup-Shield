const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'popup-guard.js'), 'utf8');

function setup() {
  const listeners = {}, opened = [];
  class Element { matches() { return true; } }
  const window = {
    location: { href: 'https://example.co.uk/watch' },
    open: url => { opened.push(url); return 'opened'; },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const context = vm.createContext({
    URL, Element, window, document: { baseURI: window.location.href, querySelector: () => null },
    console: { info() {}, warn() {} },
  });
  vm.runInContext(source, context);
  return { window, listeners, opened, Element, context };
}

test('allows same-host and relative window.open without a configuration file', () => {
  const app = setup();
  assert.equal(app.window.open('/episode'), 'opened');
  assert.equal(app.window.open('https://example.co.uk/next'), 'opened');
  assert.equal(app.opened.length, 2);
});
test('blocks unrelated co.uk, misleading suffixes and blank popups', () => {
  const app = setup();
  for (const url of ['https://other.co.uk/', 'https://example.co.uk.attacker.org/', 'about:blank', '', 'javascript:alert(1)']) {
    assert.equal(app.window.open(url), null);
  }
  assert.equal(app.opened.length, 0);
});
test('duplicate script execution does not wrap twice', () => {
  const app = setup(), wrapped = app.window.open;
  vm.runInContext(source, app.context);
  assert.equal(app.window.open, wrapped);
});
test('blocks external link opening a new tab but preserves a same-host one', () => {
  const app = setup();
  for (const [href, blocked] of [['https://ads.invalid/', true], ['/episode', false]]) {
    const anchor = new app.Element();
    anchor.getAttribute = name => name === 'href' ? href : '_blank';
    let prevented = false;
    app.listeners.click({ type: 'click', composedPath: () => [anchor], preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
    assert.equal(prevented, blocked);
  }
});
test('formaction override cannot open an external form target', () => {
  const app = setup();
  let prevented = false;
  app.listeners.submit({
    target: { getAttribute: name => name === 'action' ? '/local' : '_blank' },
    submitter: { getAttribute: name => name === 'formaction' ? 'https://ads.invalid/' : null },
    preventDefault() { prevented = true; }, stopImmediatePropagation() {},
  });
  assert.equal(prevented, true);
});
