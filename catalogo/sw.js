const CACHE_NAME = 'esentia-app-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/esentia-optimizado.css',
  '/app.js',
  '/manifest.json'
  // ❌ REMUEVE '/images/logo.png' si no existe
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cachea archivos individualmente para que uno fallido no rompa todo
        return Promise.all(
          ASSETS_TO_CACHE.map(url => 
            fetch(url)
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                console.warn(`⚠️ No se pudo cachear ${url}: ${response.status}`);
              })
              .catch(err => console.warn(`⚠️ Error cachear ${url}:`, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});