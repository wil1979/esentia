// sw.js
const CACHE_NAME = 'esentia-app-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/esentia-optimizado.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});