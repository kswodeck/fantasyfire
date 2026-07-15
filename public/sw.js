/*
 * FantasyFire service worker — offline shell + static asset caching.
 * Uses the Cache API only (no localStorage for app state). The API + URL stay
 * the source of truth (PLAN §3b #8); caches are disposable.
 */
const VERSION = 'ff-v3';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = '/offline';
const PRECACHE = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Precache each URL independently — cache.addAll() rejects wholesale if a
      // single request fails, which would leave the SW permanently uninstalled.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
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

  // Content-hashed build assets are immutable — a cache hit is final, so serve it
  // WITHOUT the background revalidation fetch. That fetch was firing an origin/edge
  // request on every cached asset load (many per page), for files that can never
  // change. Genuinely mutable static assets (icons, favicons) keep stale-while-
  // revalidate so a re-brand still propagates.
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(cacheFirstImmutable(request, STATIC_CACHE));
    return;
  }

  const isStatic =
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

// --- Web Push -------------------------------------------------------------
// Value-first digest notifications (e.g. "your players have a strong lean"). The
// payload is a small JSON {title, body, url, tag} sent by run-push.ts.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'FantasyFire';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'ff-digest',
    data: { url: data.url || '/' },
  };
  // Rich "big picture" card image (supported on Android/desktop Chrome;
  // platforms that can't render it just show the plain notification).
  if (data.image) options.image = data.image;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});

async function putIfOk(cache, request, response) {
  if (response && response.ok && response.type === 'basic') {
    cache.put(request, response.clone());
  }
  return response;
}

// Cache-first for immutable, content-hashed assets: a cache hit is authoritative,
// so no background network request is made. Only a miss touches the network.
async function cacheFirstImmutable(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  // Miss: fetch once and cache. A failure here is a genuine network error for an
  // uncached asset — surface it, exactly as a normal (non-SW) request would.
  const res = await fetch(request);
  return putIfOk(cache, request, res);
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

// Network-first, falling back to cache, then the offline shell, when offline.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    return putIfOk(cache, request, res);
  } catch {
    const cached = await cache.match(request);
    return (
      cached ||
      (await caches.match(OFFLINE_URL)) ||
      (await caches.match('/')) ||
      Response.error()
    );
  }
}
