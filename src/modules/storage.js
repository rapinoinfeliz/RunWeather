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
const DB_VERSION = 11; // Clean slate attempt
const STORE_CLIMATE = 'climate_history';

export function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_CLIMATE)) {
                db.createObjectStore(STORE_CLIMATE, { keyPath: 'key' });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => {
            console.warn("IndexedDB Failed (Use fallback)", e);
            reject(e);
        };
    });
}

export async function getCachedClimate(lat, lon) {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    try {
        const db = await openDB();
        console.log(`Checking IDB for: ${key}`);
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_CLIMATE, 'readonly');
            // Safe fallback if store missing despite open success
            if (!tx.objectStoreNames.contains(STORE_CLIMATE)) {
                resolve(null); return;
            }
            const store = tx.objectStore(STORE_CLIMATE);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.data : null);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        console.warn("IDB unavailable, checking LS backup");
        return loadFromStorage('rw_climate_backup_' + key);
    }
}

export async function cacheClimate(lat, lon, data) {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_CLIMATE, 'readwrite');
        tx.objectStore(STORE_CLIMATE).put({ key, data, timestamp: Date.now() });
    } catch (e) {
        console.warn("IDB unavailable, saving to LS backup");
        // Fallback: Save to LocalStorage (Max 1 item to avoid quota)
        // Clear old backups first to be safe
        for (let k in localStorage) {
            if (k.startsWith('rw_climate_backup_') && k !== 'rw_climate_backup_' + key) {
                localStorage.removeItem(k);
            }
        }
        saveToStorage('rw_climate_backup_' + key, data);
    }
}
