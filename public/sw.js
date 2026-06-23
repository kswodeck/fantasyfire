/*
 * FantasyFire service worker — offline shell + static asset caching.
 * Uses the Cache API only (no localStorage for app state). The API + URL stay
 * the source of truth (PLAN §3b #8); caches are disposable.
 */
const VERSION = 'ff-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const PRECACHE = [
  '/',
  '/players',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // never cache the JSON API

  const isStatic =
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons/') ||
    /\.(png|svg|ico|css|js|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGE_CACHE));
  }
});

async function putIfOk(cache, request, response) {
  if (response && response.ok && response.type === 'basic') {
    cache.put(request, response.clone());
  }
  return response;
}

// Cache-first with a background refresh (stale-while-revalidate).
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => putIfOk(cache, request, res))
    .catch(() => undefined);
  return cached || (await network) || fetch(request);
}

// Network-first, falling back to cache (or the cached home shell) when offline.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    return putIfOk(cache, request, res);
  } catch {
    const cached = await cache.match(request);
    return cached || (await caches.match('/')) || Response.error();
  }
}
