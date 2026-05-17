const CACHE_NAME = 'lido-ofp-offline-v2';
const APP_SHELL = './index.html';
const SAME_ORIGIN_PRECACHE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of SAME_ORIGIN_PRECACHE) {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (e) {
        console.warn('precache skipped', url, e);
      }
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    const shell = await cache.match(APP_SHELL) || await cache.match('./');
    if (shell) return shell;
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const accept = req.headers.get('accept') || '';
  const isNavigate = req.mode === 'navigate' || accept.includes('text/html');
  const url = new URL(req.url);

  if (isNavigate) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (['script', 'style', 'worker'].includes(req.destination) || /cdn|unpkg|cdnjs/.test(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
});
