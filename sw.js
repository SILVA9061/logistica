const CACHE_NAME = 'logistica-oppo-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('[Service Worker] Instalado!');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(cacheNames.map((cache) => {
                if (cache !== CACHE_NAME) return caches.delete(cache);
            }));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // LINHA MÁGICA: Ignora Supabase e Google Drive para não dar erro de imagem/CORS
    if (event.request.url.includes('supabase.co') || 
        event.request.url.includes('script.google.com') ||
        event.request.url.includes('googleusercontent.com') ||
        event.request.url.includes('drive.google.com')) {
        return; 
    }
    
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});