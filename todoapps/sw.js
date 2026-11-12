const CACHE_NAME = 'todo-app-v2'; // Diubah ke v2 agar HP otomatis mereset cache lama
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/Script.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Belanosima:wght@400;600;700&family=Funnel+Display:wght@300..800&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=Space+Grotesk:wght@300..700&display=swap'
];

// 1. Instalasi Service Worker & Caching Awal
self.addEventListener('install', event => {
  self.skipWaiting(); // Memaksa PWA langsung memakai versi terbaru ini
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Aktivasi: Hapus Cache Lama Secara Otomatis
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName); // Hapus memori nyangkut
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Menangkap Request (Network Interceptor)
self.addEventListener('fetch', event => {
  
  // PENGECUALIAN 1: Biarkan request POST (seperti menembak API AI Gemini) lewat!
  if (event.request.method === 'POST') {
      return; 
  }

  // PENGECUALIAN 2: Abaikan URL dari luar (seperti ikon SVG) kecuali yang sudah kita cache
  if (!event.request.url.startsWith(self.location.origin) && !urlsToCache.includes(event.request.url)) {
      return;
  }

  // Proses Cache Normal
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Jika file ada di memori HP, pakai itu. Jika tidak, download dari internet.
        return response || fetch(event.request);
      })
  );
});