const CACHE_NAME = 'runweather-v58-mobile-tooltips';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './src/main.js',
    './src/modules/core.js',
    './src/modules/ui.js',
    './src/modules/ui/events.js',
    './src/modules/ui/renderers.js',
    './src/modules/ui/state.js',
    './src/modules/ui/utils.js',
    './src/modules/managers.js',
    './src/modules/api.js',
    './src/modules/storage.js',
    './src/modules/engine.js',
    './src/modules/climate_manager.js',
    './src/modules/ui/effects.js',
    './data/hap_grid.js'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
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
            ).then(() => self.clients.claim());
        })
    );
});

self.addEventListener('fetch', (e) => {
    // Explicitly bypass external API domains to prevent CORS/Opaque issues
    const url = e.request.url;
    if (e.request.method !== 'GET' || url.includes('open-meteo') || url.includes('ipwho.is') || !url.startsWith(self.location.origin)) {
        return;
    }

    const isAppShellAsset =
        e.request.mode === 'navigate'
        || e.request.destination === 'document'
        || e.request.destination === 'script'
        || e.request.destination === 'style';

    if (isAppShellAsset) {
        // Network-first to avoid stale JS/CSS on mobile after deploys.
        e.respondWith(
            fetch(e.request)
                .then((res) => {
                    if (res && res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
                    }
                    return res;
                })
                .catch(() => caches.match(e.request, { ignoreSearch: true }))
        );
        return;
    }

    // Cache-first for other local assets.
    e.respondWith(
        caches.match(e.request, { ignoreSearch: true }).then((res) => {
            if (res) return res;
            return fetch(e.request).then((netRes) => {
                if (netRes && netRes.ok) {
                    const copy = netRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
                }
                return netRes;
            }).catch((err) => {
                console.warn('SW Fetch Fail:', e.request.url, err);
            });
        })
    );
});
