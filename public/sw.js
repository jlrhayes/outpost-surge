/* Outpost Surge service worker (hand-written, no Workbox).
 *
 * Strategy
 *  - Navigations / HTML: network-first, so a new deploy is picked up on the next launch; the cached page is
 *    used when offline.
 *  - Hashed build assets (assets/*): cache-first. Their file names change whenever their content does.
 *  - Everything else in scope (manifest, icons): network-first with cache fallback.
 *
 * The production build (scripts/vite-plugin-sw.mjs) replaces __BUILD_ID__ with a hash of the build and fills
 * in the precache list. A new build => new cache name; old caches are deleted on activate.
 * All URLs are resolved relative to the registration scope, so this works at any base path
 * (e.g. https://<user>.github.io/<repo>/).
 */
const BUILD_ID = '__BUILD_ID__';
const PRECACHE = [/* __PRECACHE__ */];

const CACHE_PREFIX = 'outpost-surge-';
const CACHE = CACHE_PREFIX + BUILD_ID;
const SCOPE = self.registration.scope;
const ASSETS_PREFIX = new URL('assets/', SCOPE).href;
const START_URL = new URL('./', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (path) => {
          const url = new URL(path, SCOPE).href;
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) await cache.put(url, response);
          } catch (err) {
            // Offline or flaky network during install: the file is cached on first use instead.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;

  const accept = request.headers.get('accept') || '';
  if (request.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(networkFirst(request, true));
  } else if (url.href.startsWith(ASSETS_PREFIX)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request, false));
  }
});

function cacheable(response) {
  return response && response.ok && response.type === 'basic' && !response.redirected;
}

async function networkFirst(request, isPage) {
  const cache = await caches.open(CACHE);
  const fallback = async () =>
    (await cache.match(request, { ignoreSearch: true })) || (isPage ? await cache.match(START_URL) : undefined);
  // Pages revalidate with the server (GitHub Pages sends max-age=600) so new builds arrive promptly.
  const network = fetch(isPage ? new Request(request, { cache: 'no-cache' }) : request).then(async (response) => {
    if (cacheable(response)) await cache.put(request, response.clone());
    return response;
  });
  if (isPage) {
    // Connected-but-dead networks can hang for a long time: fall back to the cached game after 3.5 s.
    const timeout = new Promise((resolve) => setTimeout(resolve, 3500, null));
    const first = await Promise.race([network.catch(() => null), timeout]);
    if (first) return first;
    const cached = await fallback();
    if (cached) return cached;
  }
  try {
    return await network;
  } catch (err) {
    const cached = await fallback();
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) await cache.put(request, response.clone());
  return response;
}
