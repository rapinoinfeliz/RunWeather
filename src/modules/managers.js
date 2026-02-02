// Managers: State Management for Location and Climate
import { loadFromStorage, saveToStorage } from './storage.js';
import { searchCity } from './api.js';

export const DEFAULT_LOC = { lat: -27.5969, lon: -48.5495, name: 'Florianópolis', country: 'BR', isDefault: true };


export class LocationManager {
    constructor(onLocationChanged) {
        this.current = this.loadState() || DEFAULT_LOC;
        this.recents = this.loadRecents() || [];
        this.favorites = this.loadFavorites() || [];
        this.onLocationChanged = onLocationChanged;
    }

    loadState() {
        const saved = loadFromStorage('rw_location');
        if (saved) {
            saved.lat = Number(saved.lat);
            saved.lon = Number(saved.lon);
        }
        return saved;
    }

    loadRecents() {
        let recents = loadFromStorage('rw_recents') || [];
        // Robust Dedupe AND Type Sanitization on Load
        const unique = [];
        recents.forEach(r => {
            // Force Number types to prevent downstream crashes
            r.lat = Number(r.lat);
            r.lon = Number(r.lon);

            if (!unique.some(u => this._isSameLocation(u, r))) {
                unique.push(r);
            }
        });
        return unique;
    }

    saveState() {
        saveToStorage('rw_location', this.current);
    }

    saveRecents() {
        saveToStorage('rw_recents', this.recents);
    }

    // --- Favorites Logic ---
    loadFavorites() {
        const favs = loadFromStorage('rw_favorites') || [];
        favs.forEach(f => { f.lat = Number(f.lat); f.lon = Number(f.lon); });
        return favs;
    }

    saveFavorites() {
        saveToStorage('rw_favorites', this.favorites);
    }

    isFavorite(loc) {
        if (!loc) loc = this.current;
        return this.favorites.some(f => this._isSameLocation(f, loc));
    }

    toggleFavorite(loc) {
        if (!loc) loc = this.current;
        if (this.isFavorite(loc)) {
            // Remove
            this.favorites = this.favorites.filter(f => !this._isSameLocation(f, loc));
        } else {
            // Add (Save minimal data)
            this.favorites.push({
                lat: Number(loc.lat),
                lon: Number(loc.lon),
                name: loc.name,
                country: loc.country
            });
        }
        this.saveFavorites();
        return this.isFavorite(loc);
    }

    async setLocation(lat, lon, name, country) {
        lat = Number(lat);
        lon = Number(lon);
        // 1. Snap to existing recent location to stabilize coordinates (and cache keys)
        // If we are "at" a known recent location, use its saved lat/lon.
        let newLoc = { lat, lon, name, country, isDefault: false };

        // Find match in recents (using our robust check)
        const match = this.recents.find(r => this._isSameLocation(r, newLoc));
        if (match) {
            console.log("Snapping location to recent match:", match.name);
            newLoc = { ...match }; // Use the stable coordinates
            // Ensure we keep the isDefault false unless logic dictates
            newLoc.isDefault = false;
        }

        this.current = newLoc;

        // Check if back to default (approx)
        if (Math.abs(lat - DEFAULT_LOC.lat) < 0.05 && Math.abs(lon - DEFAULT_LOC.lon) < 0.05) {
            this.current = { ...DEFAULT_LOC };
        }

        // Update Recents (remove existing match)
        this.recents = this.recents.filter(r => !this._isSameLocation(r, this.current));

        this.recents.unshift(this.current);
        if (this.recents.length > 5) this.recents = this.recents.slice(0, 5);
        this.saveRecents();

        console.log("Location Set:", this.current);
        this.saveState();

        if (this.onLocationChanged) {
            this.onLocationChanged(this.current);
        }
    }

    async searchCity(query) {
        return await searchCity(query);
    }

    _isSameLocation(loc1, loc2) {
        if (!loc1 || !loc2) return false;

        const n1 = this._normalize(loc1.name);
        const n2 = this._normalize(loc2.name);
        const c1 = this._normalize(loc1.country);
        const c2 = this._normalize(loc2.country);

        // 1. Same Name -> Same Location (Solves 'BR' vs 'Brazil' mismatch)
        if (n1 === n2) return true;

        // 2. Coordinate Match (fallback for diverse names)
        if (loc1.lat != null && loc1.lon != null && loc2.lat != null && loc2.lon != null) {
            const dLat = Math.abs(Number(loc1.lat) - Number(loc2.lat));
            const dLon = Math.abs(Number(loc1.lon) - Number(loc2.lon));
            if (dLat < 0.1 && dLon < 0.1) return true;
        }
        return false;
    }

    _normalize(str) {
        if (!str) return "";
        return str.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Strip accents
            .trim();
    }
}

