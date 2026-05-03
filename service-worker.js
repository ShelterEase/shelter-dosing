// Shelter Drug Dosing — Service Worker
// Caches all assets on first load so the app works fully offline after that.

const CACHE_NAME = 'shelter-dosing-v8';

// Files to cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap',
];

// ── Install: pre-cache core files ─────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can — fonts may fail cross-origin, that's OK
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.log('Could not cache:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fall back to network ──
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if(event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if(cachedResponse) {
        // Serve from cache immediately
        // Also fetch fresh copy in background to update cache
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if(networkResponse && networkResponse.ok){
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {}); // Silently fail if offline
        
        return cachedResponse; // Return cached version right away
      }

      // Not in cache — try network and cache the result
      return fetch(event.request)
        .then(networkResponse => {
          if(!networkResponse || !networkResponse.ok) return networkResponse;
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => {
          // Offline and not cached — return a simple offline message
          // (only for navigation requests, not assets)
          if(event.request.mode === 'navigate'){
            return caches.match('./index.html');
          }
        });
    })
  );
});
