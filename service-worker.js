self.addEventListener('install', e => {
  console.log('Esentia PWA instalada');
  self.skipWaiting();
});

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
