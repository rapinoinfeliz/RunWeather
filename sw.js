const CACHE_NAME = 'runweather-v2';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './src/main.js',
    './src/modules/core.js',
    './src/modules/ui.js',
    './src/modules/managers.js',
    './src/modules/api.js',
    './src/modules/storage.js',
    './src/modules/engine.js',
    './src/modules/climate_manager.js',
    './data/hap_grid.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request);
        })
    );
});
