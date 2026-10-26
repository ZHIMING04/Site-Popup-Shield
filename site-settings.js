(() => {
  'use strict';
  function hostname(value) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(url.hostname) ? url.hostname : null;
    } catch { return null; }
  }
  function normalizeSites(values) {
    if (!Array.isArray(values)) throw new Error('Invalid website list.');
    return [...new Set(values.map(value => {
      if (typeof value !== 'string' || hostname(`https://${value}`) !== value) {
        throw new Error('Invalid website hostname.');
      }
      return value;
    }))].sort();
  }
  const pattern = site => `*://${site}/*`;
  const origins = site => [`http://${site}/*`, `https://${site}/*`];
  const scriptId = site => `shield-${site}`;
  function rules(sites) {
    return sites.map((site, index) => ({
      id: index + 1, priority: 1, action: { type: 'block' },
      condition: { initiatorDomains: [site], excludedRequestDomains: [site], resourceTypes: ['main_frame'] },
    }));
  }
  function scripts(sites) {
    return sites.map(site => ({
      id: scriptId(site), matches: [pattern(site)], js: ['popup-guard.js'],
      runAt: 'document_start', world: 'MAIN', allFrames: true,
      matchOriginAsFallback: true, persistAcrossSessions: true,
    }));
  }
  globalThis.ShieldSettings = Object.freeze({ hostname, normalizeSites, pattern, origins, scriptId, rules, scripts });
})();
