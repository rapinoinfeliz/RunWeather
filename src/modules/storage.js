// Storage Module: wrappers for LocalStorage

export function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('Storage save failed', e);
    }
}

export function loadFromStorage(key) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.error('Storage load failed', e);
        return null;
    }
}

// --- IndexedDB for Large Data (Climate History) ---
const DB_NAME = 'RunWeatherDB';
const DB_VERSION = 10; // Force major upgrade to reset stores
const STORE_CLIMATE = 'climate_history';

export function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            // Robust Store Reset
            if (db.objectStoreNames.contains(STORE_CLIMATE)) {
                try {
                    db.deleteObjectStore(STORE_CLIMATE);
                } catch (err) { console.warn("Store delete warning", err); }
            }
            db.createObjectStore(STORE_CLIMATE, { keyPath: 'key' });
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e);
    });
}

export async function getCachedClimate(lat, lon) {
    try {
        const db = await openDB();
        const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_CLIMATE, 'readonly');
            const store = tx.objectStore(STORE_CLIMATE);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.data : null);
            req.onerror = () => resolve(null);
        });
    } catch (e) { console.error(e); return null; }
}

export async function cacheClimate(lat, lon, data) {
    try {
        const db = await openDB();
        const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        const tx = db.transaction(STORE_CLIMATE, 'readwrite');
        tx.objectStore(STORE_CLIMATE).put({ key, data, timestamp: Date.now() });
    } catch (e) { console.error("Cache failed", e); }
}
