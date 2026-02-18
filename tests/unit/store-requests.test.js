import { describe, expect, it } from 'vitest';
import {
    AppStore,
    beginRequest,
    cancelRequest,
    endRequest,
    isRequestCurrent
} from '../../src/modules/store.js';

function uniqueKey(seed) {
    return `unit_req_${seed}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

describe('store request lifecycle', () => {
    it('marks requests in-flight and completes with success', () => {
        const key = uniqueKey('success');
        const req = beginRequest(key, { abortPrevious: true, meta: { from: 'unit' } });

        const running = AppStore.getState().requests[key];
        expect(running.inFlight).toBe(true);
        expect(running.status).toBe('running');
        expect(running.seq).toBe(req.seq);
        expect(isRequestCurrent(key, req.seq)).toBe(true);

        endRequest(key, req.seq, 'success');

        const done = AppStore.getState().requests[key];
        expect(done.inFlight).toBe(false);
        expect(done.status).toBe('success');
        expect(done.error).toBeNull();
    });

    it('aborts previous in-flight request when starting a newer one', () => {
        const key = uniqueKey('abort');
        const first = beginRequest(key, { abortPrevious: true });
        let firstWasAborted = false;
        first.signal.addEventListener('abort', () => {
            firstWasAborted = true;
        });

        const second = beginRequest(key, { abortPrevious: true });
        expect(firstWasAborted).toBe(true);
        expect(isRequestCurrent(key, first.seq)).toBe(false);
        expect(isRequestCurrent(key, second.seq)).toBe(true);

        endRequest(key, second.seq, 'success');
        const done = AppStore.getState().requests[key];
        expect(done.status).toBe('success');
        expect(done.inFlight).toBe(false);
    });

    it('cancels active request and stores aborted status/error', () => {
        const key = uniqueKey('cancel');
        beginRequest(key, { abortPrevious: true });
        cancelRequest(key, 'manual-cancel');

        const slot = AppStore.getState().requests[key];
        expect(slot.inFlight).toBe(false);
        expect(slot.status).toBe('aborted');
        expect(slot.error).toBe('manual-cancel');
    });
});
