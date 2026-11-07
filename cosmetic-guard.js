(() => {
  'use strict';

  if (globalThis.__sitePopupShieldCosmeticInstalled) return;
  Object.defineProperty(globalThis, '__sitePopupShieldCosmeticInstalled', { value: true });

  function unlockScroll() {
    try {
      const html = document.documentElement;
      const body = document.body;
      if (!html) return;

      const htmlStyle = window.getComputedStyle(html);
      if (htmlStyle.overflow === 'hidden' || htmlStyle.overflowY === 'hidden' || htmlStyle.position === 'fixed') {
        html.style.setProperty('overflow', 'auto', 'important');
        html.style.setProperty('position', 'static', 'important');
      }

      if (body) {
        const bodyStyle = window.getComputedStyle(body);
        if (bodyStyle.overflow === 'hidden' || bodyStyle.overflowY === 'hidden' || bodyStyle.position === 'fixed') {
          body.style.setProperty('overflow', 'auto', 'important');
          body.style.setProperty('position', 'static', 'important');
        }
      }
    } catch {}
  }

  // Observe scroll locks and body class additions
  let pendingUnlock = false;
  function scheduleUnlock() {
    if (pendingUnlock) return;
    pendingUnlock = true;
    requestAnimationFrame(() => {
      pendingUnlock = false;
      unlockScroll();
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
        scheduleUnlock();
      }
    }
  });

  function startObserving() {
    unlockScroll();
    if (document.documentElement) {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  } else {
    startObserving();
  }

  // Run periodic unlock during initial page load to catch late CMP scripts
  let checkCount = 0;
  const interval = setInterval(() => {
    unlockScroll();
    if (++checkCount > 10) clearInterval(interval);
  }, 500);
})();

