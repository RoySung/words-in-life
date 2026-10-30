/* Generated at build time. Only public, same-origin app assets enter this cache. */
const CACHE_NAME = __CACHE_NAME__;
const PRECACHE_URLS = __PRECACHE_URLS__;
const ASSET_PATHS = new Set(PRECACHE_URLS);

self.addEventListener('install', event => {
  // No skipWaiting: open tabs keep a consistent version until all are closed.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('words-in-life-shell-') && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Keep the document and lazy chunks on the same release, online and offline.
  const appNavigation = request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname);
  const asset = ASSET_PATHS.has(url.pathname) && !url.search;
  if (!appNavigation && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(appNavigation ? '/index.html' : url.pathname);
    return cached || fetch(request);
  })());
});
