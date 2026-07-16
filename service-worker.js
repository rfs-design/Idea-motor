// service-worker.js — IdeaMotor PWA caching

const CACHE_NAME = 'ideamotor-v23';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/storage.js',
  './js/settings.js',
  './js/speech.js',
  './js/gemini-engine.js',
  './js/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // API calls: stay out of the way entirely — let the browser do the fetch natively.
  // Calling respondWith(fetch(...)) here wrapped every network hiccup in an opaque
  // "FetchEvent.respondWith received an error: TypeError: Load failed", which then
  // surfaced verbatim to the user instead of the app's own message. We never cache
  // these responses anyway, so there is nothing to gain by intercepting them.
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('anthropic.com')) {
    return;
  }

  // Cache-first for app assets
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }))
      // Never let respondWith reject: a rejection surfaces as the same opaque error.
      .catch(() => new Response('', { status: 504, statusText: 'Offline' }))
  );
});
