import { beforeEach, describe, expect, it } from 'vitest';
import { LocationManager } from '../../src/modules/managers.js';

function createLocalStorageMock() {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
        key(index) {
            return Array.from(store.keys())[index] || null;
        },
        get length() {
            return store.size;
        }
    };
}

describe('LocationManager homonymous city handling', () => {
    beforeEach(() => {
        globalThis.localStorage = createLocalStorageMock();
    });

    it('does not treat same-name distant cities as same location', () => {
        const manager = new LocationManager();
        const urupemaSc = { name: 'Urupema', country: 'BR', region: 'Santa Catarina', lat: -27.95, lon: -49.87 };
        const urupemaAl = { name: 'Urupema', country: 'BR', region: 'Alagoas', lat: -9.47, lon: -36.20 };

        expect(manager._isSameLocation(urupemaSc, urupemaAl)).toBe(false);
    });

    it('still treats nearby coordinates as same city despite text differences', () => {
        const manager = new LocationManager();
        const a = { name: 'Florianópolis', country: 'BR', lat: -27.5969, lon: -48.5495 };
        const b = { name: 'Florianopolis', country: 'Brazil', lat: -27.62, lon: -48.57 };

        expect(manager._isSameLocation(a, b)).toBe(true);
    });

    it('keeps both homonymous cities in recents and switches correctly', async () => {
        const manager = new LocationManager();

        await manager.setLocation(-27.95, -49.87, 'Urupema', 'BR', { region: 'Santa Catarina' });
        await manager.setLocation(-9.47, -36.20, 'Urupema', 'BR', { region: 'Alagoas' });

        expect(manager.current.region).toBe('Alagoas');
        expect(manager.recents.length).toBe(2);
        expect(manager.recents[0].region).toBe('Alagoas');
        expect(manager.recents[1].region).toBe('Santa Catarina');
    });
});
