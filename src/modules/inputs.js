// Input handling helpers extracted from main.js init()
import { saveToStorage } from './storage.js';
import { AppState } from './appState.js';

/**
 * Parse a time string (MM:SS or H:MM:SS) into total seconds.
 */
export function localParseTime(str) {
    if (!str) return 0;
    str = str.toString().trim();
    if (str === '' || str === '--:--') return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    // Fallback to just digits
    const digits = str.replace(/[^0-9]/g, '');
    if (!digits) return 0;
    if (digits.length <= 2) return parseInt(digits, 10);
    const s = parseInt(digits.slice(-2), 10);
    const m = parseInt(digits.slice(0, -2), 10);
    return m * 60 + s;
}

/**
 * Format seconds into MM:SS string.
 */
export function localFormatTime(sec) {
    if (isNaN(sec) || sec < 0) return "0:00";
    let m = Math.floor(sec / 60);
    let s = Math.round(sec % 60);
    if (s === 60) { m++; s = 0; }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Adjust a time string by deltaSec seconds.
 */
export function adjustTime(valStr, deltaSec) {
    const sec = localParseTime(valStr);
    let newSec = sec + deltaSec;
    if (newSec < 0) newSec = 0;
    return localFormatTime(newSec);
}

/**
 * Adjust a distance value by deltaMeters.
 */
export function adjustDistance(valStr, deltaMeters) {
    let val = parseFloat(valStr) || 0;
    let newVal = val + deltaMeters;
    if (newVal < 0) newVal = 0;
    return newVal;
}

/**
 * Auto-format time inputs on blur (e.g., "1920" -> "19:20")
 */
export function formatTimeInput(el) {
    if (!el) return;
    el.addEventListener('blur', () => {
        let val = el.value.replace(/[^0-9]/g, '');
        if (val.length === 0) return;
        if (val.length === 1) val = '0' + val;
        if (val.length === 2) val = '0' + val;
        const secs = val.slice(-2);
        const mins = val.slice(0, -2) || '0';
        el.value = `${parseInt(mins, 10)}:${secs}`;
    });
}

/**
 * Numeric keypad formatting for time inputs (auto-insert colon).
 */
export function handleTimeInput(e) {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 4) val = val.slice(0, 4);
    if (val.length >= 3) {
        val = val.slice(0, val.length - 2) + ':' + val.slice(val.length - 2);
    }
    e.target.value = val;
}

/**
 * Save calculator state (distance + time) to storage.
 */
export function saveCalcState(els) {
    const state = {
        distance: els.distance ? els.distance.value : '',
        time: els.time ? els.time.value : ''
    };
    saveToStorage('vdot_calc_state', state);
}

/**
 * Setup fine-tuning (arrow key acceleration) on an input element.
 * @param {HTMLInputElement} el
 * @param {'time'|'dist'} type
 * @param {object} els - Element references for cross-field updates
 * @param {function} updateFn - UI.update callback
 */
export function setupFineTuning(el, type, els, updateFn) {
    if (!el) return;

    let repeatCount = 0;
    let lastKey = null;

    el.addEventListener('keyup', () => {
        repeatCount = 0;
        lastKey = null;
    });

    el.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();

            if (lastKey === e.key) {
                repeatCount++;
            } else {
                repeatCount = 0;
                lastKey = e.key;
            }

            const isUp = e.key === 'ArrowUp';
            const dir = isUp ? 1 : -1;

            if (type === 'time') {
                const turbo = e.shiftKey ? 10 : 1;
                el.value = adjustTime(el.value, dir * turbo);
            } else if (type === 'dist') {
                let step = 1;
                if (e.shiftKey) {
                    step = 100;
                } else {
                    if (repeatCount > 20) step = 100;
                    else if (repeatCount > 5) step = 10;
                    else step = 1;
                }
                el.value = adjustDistance(el.value, dir * step);
            }

            el.dispatchEvent(new Event('input'));

            // Cross-field updates
            if (el === els.time) {
                const tSec = localParseTime(els.time.value);
                const d = parseFloat(els.distance.value);
                if (tSec > 0 && d > 0 && els.inputPace) {
                    const pacePerKm = tSec / (d / 1000);
                    els.inputPace.value = localFormatTime(pacePerKm);
                }
            } else if (el === els.inputPace) {
                const p = localParseTime(els.inputPace.value);
                const dStr = els.distance.value;
                if (p > 0 && dStr) {
                    const d = parseFloat(dStr);
                    const tSec = (d / 1000.0) * p;
                    els.time.value = localFormatTime(tSec);
                    updateFn(els, AppState.hapCalc);
                }
            } else if (el === els.distance) {
                const tSec = localParseTime(els.time.value);
                const d = parseFloat(els.distance.value);
                if (tSec > 0 && d > 0 && els.inputPace) {
                    const pacePerKm = tSec / (d / 1000);
                    els.inputPace.value = localFormatTime(pacePerKm);
                }
            }
        }
    });
}
