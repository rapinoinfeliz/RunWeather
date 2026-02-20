import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchCity } from '../../src/modules/api.js';

const originalFetch = globalThis.fetch;

function mockSearchResults(results) {
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        async json() {
            return { results };
        }
    });
}

afterEach(() => {
    if (originalFetch) {
        globalThis.fetch = originalFetch;
    } else {
        delete globalThis.fetch;
    }
});

describe('searchCity ranking and dedupe', () => {
    it('dedupes same city/state/country even when coordinates differ', async () => {
        mockSearchResults([
            {
                name: 'Urupema',
                admin1: 'Alagoas',
                country: 'Brasil',
                country_code: 'BR',
                latitude: -9.45,
                longitude: -35.93
            },
            {
                name: 'Urupema',
                admin1: 'Santa Catarina',
                country: 'Brasil',
                country_code: 'BR',
                latitude: -27.95278,
                longitude: -49.87306,
                population: 2500
            },
            {
                name: 'Urupema',
                admin1: 'Santa Catarina',
                country: 'Brasil',
                country_code: 'BR',
                latitude: -26.86578,
                longitude: -52.20614,
                population: 600
            }
        ]);

        const result = await searchCity('urupema', { force: true, count: 10 });

        expect(result.filter((item) => item.admin1 === 'Santa Catarina')).toHaveLength(1);
        expect(result.some((item) => item.admin1 === 'Alagoas')).toBe(true);
    });

    it('keeps major international city visible even with brazilian homonym', async () => {
        mockSearchResults([
            {
                name: 'Tóquio',
                admin1: 'Pará',
                country: 'Brasil',
                country_code: 'BR',
                latitude: -1.36218,
                longitude: -48.41301
            },
            {
                name: 'Tóquio',
                admin1: 'Tóquio',
                country: 'Japão',
                country_code: 'JP',
                latitude: 35.6895,
                longitude: 139.69171,
                population: 9733276
            }
        ]);

        const result = await searchCity('toquio', { force: true, count: 10 });

        expect(result[0].country_code).toBe('JP');
        expect(result[1].country_code).toBe('BR');
    });

    it('supports country hint in query like "santiago chile"', async () => {
        mockSearchResults([
            {
                name: 'Santiago do Chile',
                admin1: 'Região Metropolitana de Santiago',
                country: 'Chile',
                country_code: 'CL',
                latitude: -33.45694,
                longitude: -70.64827,
                population: 4837295
            },
            {
                name: 'Santiago de Compostela',
                admin1: 'Galiza',
                country: 'Espanha',
                country_code: 'ES',
                latitude: 42.88052,
                longitude: -8.54569
            }
        ]);

        const result = await searchCity('santiago chile', { force: true, count: 10 });

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch.mock.calls[0][0]).toContain('name=santiago');
        expect(result).toHaveLength(1);
        expect(result[0].country_code).toBe('CL');
        expect(result[0].name).toBe('Santiago');
    });
});
