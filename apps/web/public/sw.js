/*
 * Offline reading. Every work and book page a reader opens is kept (the newest 300), so
 * it can be read again without a connection; the app's own scripts, styles and fonts are
 * kept alongside. Pages always come from the network when there is one. Nothing under
 * /api or /admin is ever stored: per-reader data stays out of the cache.
 */
const VERSION = 'v1';
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const SHELL = `shell-${VERSION}`;
const MAX_PAGES = 300;
const NETWORK_TIMEOUT_MS = 5000;
const READABLE = /^\/(?:(?:ru|en)\/)?(?:works|collections)\/[^/]+$/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.add('/offline.html')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, ASSETS, SHELL].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function page(request) {
  const url = new URL(request.url);
  const key = url.origin + url.pathname + url.search;
  const cache = await caches.open(PAGES);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (res.ok && READABLE.test(url.pathname)) {
      // Re-insert so the cache's key order is "least recently read first"
      await cache.delete(key);
      await cache.put(key, res.clone());
      trim(PAGES, MAX_PAGES);
    }
    return res;
  } catch {
    return (await cache.match(key)) ?? (await cache.match(url.origin + url.pathname)) ?? (await caches.match('/offline.html'));
  }
}

async function asset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  // Hashed build files never change under the same name
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(asset(request));
    return;
  }
  // Full page loads only: in-app navigations fetch data instead, and fall back to a
  // full load when that fails, which lands here
  if (request.mode === 'navigate') event.respondWith(page(request));
});
