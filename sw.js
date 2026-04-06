// SBD 2026 — ITN Distribution Survey · Service Worker
// Modelled on the working SNT Tools SW pattern

const CACHE_NAME = 'sbd-2026-v5';

// Core app files — must all exist on server
const PRECACHE_URLS = [
  './',
  './index.html',
  './itn_movement.html',
  './script_option2.js',
  './ai_agent.js',
  './cascading_data.csv',
  './manifest.json',
  './offline.html',
  './icon-maskable-512.png',
];

// CDN libraries
const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

// Never cache these
const NEVER_CACHE = [
  'script.google.com',
  'docs.google.com',
  'api.anthropic.com',
];

// ── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Install', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        // Cache each file individually — never let one failure abort the whole install
        const all = [...PRECACHE_URLS, ...CDN_URLS];
        await Promise.all(
          all.map(url => {
            const abs = url.startsWith('http') ? url : new URL(url, self.location.href).href;
            return cache.add(abs).catch(e =>
              console.warn('[SW] Skipped:', url, e.message)
            );
          })
        );
        console.log('[SW] Cache ready');
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(n => n !== CACHE_NAME)
          .map(n => { console.log('[SW] Delete old cache:', n); return caches.delete(n); })
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Skip GAS / Sheets / Claude — always network
  if (NEVER_CACHE.some(p => url.includes(p))) return;

  // Allow CDN fonts and jsdelivr
  const allowedExternal = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
  ];
  const reqURL = new URL(url);
  const isExternal = reqURL.origin !== self.location.origin;
  const isAllowed  = allowedExternal.some(o => reqURL.hostname.includes(o));
  if (isExternal && !isAllowed) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Background-refresh same-origin files
        if (!isExternal) {
          fetch(event.request)
            .then(r => { if (r && r.status === 200) caches.open(CACHE_NAME).then(c => c.put(event.request, r)); })
            .catch(() => {});
        }
        return cached;
      }
      // Not cached — fetch and store
      return fetch(event.request.clone())
        .then(response => {
          if (!response || response.status !== 200) return response;
          if (event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate')
            return caches.match(new URL('./offline.html', self.location.href).href);
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// ── MESSAGES ──────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'CLEAR_CACHE')  caches.delete(CACHE_NAME);
});

// ── BACKGROUND SYNC ───────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-submissions') {
    console.log('[SW] Background sync: sync-submissions');
  }
});
