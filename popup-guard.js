(() => {
  'use strict';
  try {
    Object.defineProperty(window, 'open', {
      value: function () { console.info('[Popup Shield] Blocked window.open'); return null; },
      writable: false,
      configurable: false
    });
  } catch { console.warn('[Popup Shield] Could not replace window.open'); }
  const opensContext = target => target && !['_self', '_parent', '_top'].includes(target.toLowerCase());
  for (const type of ['click', 'auxclick']) {
    window.addEventListener(type, event => {
      const anchor = event.composedPath().find(node => node instanceof Element && node.matches('a[href], area[href]'));
      if (!anchor) return;
      const target = anchor.getAttribute('target') || document.querySelector('base[target]')?.getAttribute('target') || '';
      if (opensContext(target) || event.type === 'auxclick' || event.ctrlKey || event.metaKey || event.shiftKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.info('[Popup Shield] Blocked link opening another tab');
      }
    }, true);
  }
  window.addEventListener('submit', event => {
    const target = event.submitter?.getAttribute('formtarget') ?? event.target.getAttribute('target') ?? document.querySelector('base[target]')?.getAttribute('target') ?? '';
    if (opensContext(target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
