// LocalStorage Persistence

const STORAGE_KEY = 'gel_calculator_state_v1';

export function saveState(state) {
    try {
        const serialized = JSON.stringify(state);
        localStorage.setItem(STORAGE_KEY, serialized);
    } catch (e) {
        console.warn('Failed to save state', e);
    }
}

export function loadState() {
    try {
        const serialized = localStorage.getItem(STORAGE_KEY);
        if (!serialized) return null;
        return JSON.parse(serialized);
    } catch (e) {
        console.warn('Failed to load state', e);
        return null;
    }
}

// Helper to debounce saves
let timeout;
export function debouncedSave(state, delay = 1000) {
    clearTimeout(timeout);
    timeout = setTimeout(() => saveState(state), delay);
}
