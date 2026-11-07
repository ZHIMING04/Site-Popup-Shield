(() => {
  'use strict';

  const DEFAULT_OPTIONS = Object.freeze({
    popups: true,     // Standard: Blocks external popup tabs & redirects (Zero permissions needed)
    cookies: false,   // Advanced: Hides cookie consent banners (Requires page access)
    annoyances: false,// Advanced: Hides floating videos & newsletter overlays (Requires page access)
    speed: true       // Standard: Blocks ad networks & telemetry via DNR (Zero permissions needed)
  });

  // High-overhead third-party tracker, advertising, and video ad networks
  const TRACKER_DOMAINS = Object.freeze([
    'doubleclick.net',
    'googlesyndication.com',
    'adservice.google.com',
    'google-analytics.com',
    'googletagservices.com',
    'criteo.com',
    'criteo.net',
    'taboola.com',
    'outbrain.com',
    'rubiconproject.com',
    'pubmatic.com',
    'openx.net',
    'adnxs.com',
    'amazon-adsystem.com',
    'casalemedia.com',
    'smartadserver.com',
    'bidswitch.net',
    'lijit.com',
    'zemanta.com',
    'media.net',
    'revcontent.com',
    'mgid.com',
    'zergnet.com',
    'popads.net',
    'popcash.net',
    'exoclick.com',
    'trafficjunky.com',
    'propellerads.com',
    'adsterra.com',
    'connatix.com',
    'primis.tech',
    'anyclip.com',
    'vdo.ai',
    'scorecardresearch.com',
    'hotjar.com',
    'clarity.ms'
  ]);

  function getOptions(site, siteOptions) {
    const custom = siteOptions && typeof siteOptions === 'object' ? siteOptions[site] : null;
    return Object.assign({}, DEFAULT_OPTIONS, custom);
  }

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

  function rules(sites, siteOptions = {}) {
    const ruleList = [];
    sites.forEach((site, index) => {
      const opts = getOptions(site, siteOptions);
      const baseId = (index + 1) * 10;

      // Rule 1: Block unrequested cross-site redirects / main_frame navigations
      if (opts.popups) {
        ruleList.push({
          id: baseId + 1,
          priority: 1,
          action: { type: 'block' },
          condition: {
            initiatorDomains: [site],
            excludedRequestDomains: [site],
            resourceTypes: ['main_frame']
          }
        });
      }

      // Rule 2: Speed Boost - Block third-party trackers & ad networks
      if (opts.speed) {
        ruleList.push({
          id: baseId + 2,
          priority: 2,
          action: { type: 'block' },
          condition: {
            initiatorDomains: [site],
            requestDomains: TRACKER_DOMAINS,
            excludedRequestDomains: [site]
          }
        });
      }
    });
    return ruleList;
  }

  function scripts(sitesWithOriginPermission, siteOptions = {}) {
    const scriptList = [];
    for (const site of sitesWithOriginPermission) {
      const opts = getOptions(site, siteOptions);

      // In-page script for wrapping window.open and capturing link clicks before navigation
      if (opts.popups) {
        scriptList.push({
          id: `shield-popup-${site}`,
          matches: [pattern(site)],
          js: ['popup-guard.js'],
          runAt: 'document_start',
          world: 'MAIN',
          allFrames: true,
          matchOriginAsFallback: true,
          persistAcrossSessions: true
        });
      }

      // In-page script & CSS for cookie banners and floating/email overlays
      const css = [];
      if (opts.cookies) css.push('cookie-shield.css');
      if (opts.annoyances) css.push('annoyance-shield.css');

      if (css.length > 0) {
        scriptList.push({
          id: `shield-cosmetic-${site}`,
          matches: [pattern(site)],
          js: ['cosmetic-guard.js'],
          css,
          runAt: 'document_start',
          world: 'ISOLATED',
          allFrames: true,
          matchOriginAsFallback: true,
          persistAcrossSessions: true
        });
      }
    }
    return scriptList;
  }

  globalThis.ShieldSettings = Object.freeze({
    DEFAULT_OPTIONS,
    TRACKER_DOMAINS,
    getOptions,
    hostname,
    normalizeSites,
    pattern,
    origins,
    rules,
    scripts
  });
})();
