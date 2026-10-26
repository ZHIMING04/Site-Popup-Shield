(() => {
  'use strict';

  if (globalThis.__sitePopupShieldInstalled) return;
  let sourceHost;
  try {
    const page = new URL(window.location.href);
    sourceHost = page.hostname || new URL(globalThis.origin).hostname;
  } catch { return; }
  Object.defineProperty(globalThis, '__sitePopupShieldInstalled', { value: true });

  function isSameDomain(targetUrl) {
    try {
      const url = new URL(targetUrl || window.location.href, document.baseURI);
      return ['http:', 'https:'].includes(url.protocol) && url.hostname === sourceHost;
    } catch { return false; }
  }

  const opensContext = target => target && !['_self', '_parent', '_top'].includes(target.toLowerCase());

  // Wrap window.open to allow legitimate same-domain popups, but block external or blank popups
  try {
    const originalOpen = window.open;
    Object.defineProperty(window, 'open', {
      value: function (url, target, features) {
        if (url && isSameDomain(url)) {
          return originalOpen ? originalOpen.call(window, url, target, features) : null;
        }
        console.info('[Popup Shield] Blocked external/blank window.open:', url);
        return null;
      },
      writable: false,
      configurable: false
    });
  } catch {
    console.warn('[Popup Shield] Could not wrap window.open');
  }

  // Intercept clicks on links
  for (const type of ['click', 'auxclick']) {
    window.addEventListener(type, event => {
      const anchor = event.composedPath().find(node => node instanceof Element && node.matches('a[href], area[href]'));
      if (!anchor) return;

      const href = anchor.getAttribute('href');

      // Allow same-domain navigation (even with target="_blank" or middle-click)
      if (isSameDomain(href)) {
        return;
      }

      // External link: block if trying to open another tab or auxiliary click
      const target = anchor.getAttribute('target') || document.querySelector('base[target]')?.getAttribute('target') || '';
      if (opensContext(target) || event.type === 'auxclick' || event.ctrlKey || event.metaKey || event.shiftKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.info('[Popup Shield] Blocked external link opening another tab:', href);
      }
    }, true);
  }

  // Intercept form submissions
  window.addEventListener('submit', event => {
    const action = event.submitter?.getAttribute('formaction') ?? event.target.getAttribute('action') ?? window.location.href;
    if (isSameDomain(action)) {
      return;
    }

    const target = event.submitter?.getAttribute('formtarget') ?? event.target.getAttribute('target') ?? document.querySelector('base[target]')?.getAttribute('target') ?? '';
    if (opensContext(target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.info('[Popup Shield] Blocked external form submission to another tab');
    }
  }, true);
})();
