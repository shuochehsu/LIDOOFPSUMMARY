const CACHE_NAME = 'lido-ofp-offline-v1';
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "https://cdn.tailwindcss.com",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/react@18/umd/react.production.min.js"
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of PRECACHE_URLS) {
      try {
        const req = url.startsWith('http')
          ? new Request(url, { mode: 'no-cors', cache: 'reload' })
          : new Request(url, { cache: 'reload' });
        const res = await fetch(req);
        await cache.put(req, res.clone());
      } catch (e) {
        console.warn('Precache skipped:', url, e);
      }
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(name => name !== CACHE_NAME ? caches.delete(name) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch (e) {
      if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
        const shell = await cache.match('./index.html') || await cache.match('./');
        if (shell) return shell;
      }
      return new Response('Offline and resource not cached.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
