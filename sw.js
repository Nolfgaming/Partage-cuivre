const CACHE_NAME = 'app-v1';
const APP_FILES = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  // Leave non-GET and cross-origin requests (e.g. Cloudflare Insights) untouched.
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return;
  }

  const updatePromise = caches.open(CACHE_NAME).then((cache) =>
    fetch(request).then((networkResponse) => {
      if (!networkResponse || !networkResponse.ok) return networkResponse;
      return cache.put(request, networkResponse.clone()).then(
        () => networkResponse,
        () => networkResponse
      );
    })
  );

  // Register the background update while the fetch event is being dispatched.
  event.waitUntil(updatePromise.then(() => undefined, () => undefined));

  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(request))
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return updatePromise.catch(async (error) => {
          if (request.mode === 'navigate') {
            const cache = await caches.open(CACHE_NAME);
            const fallback = await cache.match('./index.html');
            if (fallback) return fallback;
          }
          throw error;
        });
      })
  );
});
