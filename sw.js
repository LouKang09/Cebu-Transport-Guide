const CACHE='cebu-map-guide-v11';
const ASSETS=['./','./manifest.json','./map-enhancer.css','./map-enhancer-pre.js','./map-enhancer.js'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Navigation and map enhancer assets are network-first so UI fixes reach
  // installed/PWA users immediately instead of getting stuck behind stale cache.
  const url = new URL(request.url);
  const isEnhancerAsset = url.origin === self.location.origin &&
    ['/map-enhancer.css','/map-enhancer-pre.js','/map-enhancer.js'].includes(url.pathname);

  if (request.mode === 'navigate' || isEnhancerAsset) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          const cacheKey = request.mode === 'navigate' ? './' : request;
          caches.open(CACHE).then(cache => cache.put(cacheKey, copy));
          return response;
        })
        .catch(() => request.mode === 'navigate' ? caches.match('./') : caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (new URL(request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
