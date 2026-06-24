// service-worker.js — IdeaMotor PWA caching

const CACHE_NAME = 'ideamotor-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/app.js',
  '/js/storage.js',
  '/js/settings.js',
  '/js/speech.js',
  '/js/gemini-engine.js',
  '/js/ui.js',
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
  // Network-first for API calls (never cache Gemini responses)
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('anthropic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for app assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return res;
    }))
  );
});
