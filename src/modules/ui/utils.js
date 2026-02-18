import { UIState } from './state.js';
import { AppState } from '../appState.js';
import { formatDateDdMm, getDateForISOWeek, getReferenceYear } from '../time.js';

export function infoIcon(title, text, className = '') {
    const safeTitle = String(title || '');
    const safeText = String(text || '');
    const tSafe = safeTitle.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const txtSafe = safeText.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const extraClass = className ? ` ${className}` : '';
    return `<span class="info-tooltip-trigger info-tooltip-trigger--inline${extraClass}" data-action="info-tooltip" data-title="${tSafe}" data-text="${txtSafe}" role="button" tabindex="0" aria-label="Info"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span>`;
}

export function getImpactColor(pct) {
    if (pct < 0.5) return "#4ade80"; // Green
    if (pct < 2.0) return "#facc15"; // Yellow
    if (pct < 3.5) return "#fb923c"; // Orange
    if (pct < 6.0) return "#f87171"; // Red
    return "#c084fc"; // Purple
}

const IMPACT_BANDS = [
    { min: -Infinity, max: 0.5, color: '#4ade80' },
    { min: 0.5, max: 2.0, color: '#facc15' },
    { min: 2.0, max: 3.5, color: '#fb923c' },
    { min: 3.5, max: 6.0, color: '#f87171' },
    { min: 6.0, max: Infinity, color: '#c084fc', cap: 10.0 }
];

function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
}

function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function rgbToHex({ r, g, b }) {
    const toHex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;

    if (max === min) return { h: 0, s: 0, l };

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;

    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;

    return { h: h / 6, s, l };
}

function hslToRgb({ h, s, l }) {
    if (s === 0) {
        const v = l * 255;
        return { r: v, g: v, b: v };
    }

    const hue2rgb = (p, q, t) => {
        let tn = t;
        if (tn < 0) tn += 1;
        if (tn > 1) tn -= 1;
        if (tn < 1 / 6) return p + (q - p) * 6 * tn;
        if (tn < 1 / 2) return q;
        if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return {
        r: hue2rgb(p, q, h + 1 / 3) * 255,
        g: hue2rgb(p, q, h) * 255,
        b: hue2rgb(p, q, h - 1 / 3) * 255
    };
}

function getImpactBand(pct) {
    for (const band of IMPACT_BANDS) {
        if (pct < band.max) return band;
    }
    return IMPACT_BANDS[IMPACT_BANDS.length - 1];
}

export function getImpactHeatmapColor(pct) {
    const band = getImpactBand(pct);
    const min = Number.isFinite(band.min) ? band.min : 0;
    const max = Number.isFinite(band.max) ? band.max : (band.cap ?? (min + 4));
    const safeMax = Math.max(max, min + 0.001);
    const safePct = clamp(Number.isFinite(pct) ? pct : min, min, safeMax);
    const t = (safePct - min) / (safeMax - min);
    const baseHsl = rgbToHsl(hexToRgb(band.color));
    const s = clamp(baseHsl.s + 0.06, 0, 1);
    const lightStart = clamp(baseHsl.l + 0.03, 0, 1);
    const lightEnd = clamp(baseHsl.l - 0.12, 0, 1);
    const l = lightStart + ((lightEnd - lightStart) * t);

    return rgbToHex(hslToRgb({ h: baseHsl.h, s, l }));
}

export function getDewColor(d) {
    if (d < 15) return "#4ade80"; // Green (Comfortable) - User Requirement
    if (d < 20) return "#facc15"; // Yellow (Sticky)
    if (d < 24) return "#fb923c"; // Orange (Uncomfortable)
    return "#f87171"; // Red (Oppressive)
}

export function getCondColor(type, val) {
    const cGood = '#4ade80';
    const cFair = '#facc15';
    const cWarn = '#fb923c';
    const cBad = '#f87171';
    const cPurple = '#c084fc';
    const cDeepBlue = '#3b82f6'; // Deep Blue

    // Additional colors defined inside original func, exposing if needed, or keeping local
    const cBlue = '#60a5fa'; // Light Blue
    const cCold = '#60a5fa'; // Blue for cold temps

    if (type === 'gust') {
        if (val > 60) return cPurple; // Severe
        if (val > 40) return cBad;    // Very Strong
        if (val > 30) return cWarn;   // Strong
        if (val >= 20) return cFair;  // Noticeable
        return cGood;                 // Minimal
    }

    if (type === 'rain') {
        if (val >= 10) return cBad;
        if (val >= 5) return cWarn;
        if (val >= 2) return cDeepBlue;
        if (val > 0) return cBlue;
        return cGood;
    }

    if (type === 'air') {
        if (val > 35) return cPurple;
        if (val > 32) return cBad;
        if (val > 28) return cWarn;
        if (val < 10) return cCold;
        return cGood;
    }
    if (type === 'hum') {
        if (val >= 90) return cBad;
        if (val >= 75) return cWarn;
        return cGood;
    }
    if (type === 'wind') {
        if (val >= 40) return cPurple; // Severe (> 40)
        if (val >= 30) return cBad;   // Strong (30-40)
        if (val >= 20) return cWarn;  // Moderate (20-30)
        if (val >= 10) return cFair;  // Light (10-20) - User requested skip blue, so Yellow
        return cGood;                 // Calm (< 10)
    }
    if (type === 'uv') {
        if (val >= 8) return cBad;
        if (val >= 6) return cWarn;
        if (val >= 3) return cFair;
        return cGood;
    }
    if (type === 'aqi') {
        if (val > 150) return cBad;
        if (val > 100) return cWarn;
        if (val > 50) return cFair;
        return cGood;
    }
    if (type === 'prob') {
        if (val >= 60) return cBad;
        if (val >= 30) return cWarn;
        return cGood;
    }
    if (type === 'pm25') {
        if (val > 35) return cBad;
        if (val > 12) return cWarn;
        return cGood;
    }
    return "var(--text-primary)";
}

export function getImpactCategory(pct) {
    if (pct < 0.5) return 'Ideal';
    if (pct < 2.0) return 'Good';
    if (pct < 3.5) return 'Fair';
    if (pct < 6.0) return 'Warning';
    return 'Severe';
}

// Helper to parse times from elements
// Note: This relies on DOM elements. Passing document as dependency or assuming global?
// DOM access in utils is okay if utils is UI-specific.
export function getBasePaceSec() {
    const mode = UIState.currentPaceMode || 'HMP';
    const parseEl = (id) => {
        const el = document.getElementById(id);
        if (!el || !el.innerText) return 300;
        const match = el.innerText.match(/(\d{1,2}:\d{2})/);
        // Simple parseTime
        if (match) {
            const p = match[1].split(':').map(Number);
            return p[0] * 60 + p[1];
        }
        return 300;
    };

    if (mode === '15KP') return parseEl('pace-3min');
    if (mode === '10KP') return parseEl('pace-1min');
    if (mode === 'HMP') return parseEl('pace-6min');
    if (mode === '30KP') return parseEl('pace-10min');
    if (mode === 'EZ') return parseEl('pace-easy');
    return 300;
}

export function getActiveWeatherTimeZone() {
    return (AppState.weatherData && AppState.weatherData.timezone)
        ? AppState.weatherData.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getDateFromWeek(w, year = getReferenceYear(getActiveWeatherTimeZone())) {
    return formatDateDdMm(getDateForISOWeek(w, year));
}

export function getWeatherIcon(code) {
    if (code == null) return '';
    const sun = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke-linecap="round" stroke-linejoin="round"/>';
    const cloud = '<path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" stroke-linecap="round" stroke-linejoin="round"/>';
    const rain = '<path d="M20 16.2A4.5 4.5 0 0017.5 8h-1.8A7 7 0 104 14.9M16 14v6M12 16v6M8 14v6" stroke-linecap="round" stroke-linejoin="round"/>';

    if (code <= 1) return `<svg class="weather-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${sun}</svg>`;
    if (code <= 48) return `<svg class="weather-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${cloud}</svg>`;
    return `<svg class="weather-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${rain}</svg>`;
}

export function updateWeatherTabState(view, activeTabName) {
    if (!view) {
        return;
    }

    // Select all buttons in the tab-nav container specifically
    const nav = view.querySelector('.tab-nav');
    if (!nav) {
        return;
    }

    nav.setAttribute('role', 'tablist');
    const buttons = nav.querySelectorAll('.tab-btn');

    buttons.forEach(b => {
        // Strict check against data-tab
        const shouldBeActive = b.dataset.tab === activeTabName;
        const tabName = b.dataset.tab || '';
        const panelId = `tab-${tabName}`;
        const tabId = b.id || `tab-trigger-${tabName}`;
        b.id = tabId;
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-controls', panelId);
        b.setAttribute('aria-selected', shouldBeActive ? 'true' : 'false');
        b.setAttribute('tabindex', shouldBeActive ? '0' : '-1');

        // Remove known visual artifacts (Ripples)
        const ripples = b.getElementsByClassName('ripple');
        while (ripples.length > 0) {
            ripples[0].remove();
        }

        if (shouldBeActive) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });

    // Content Handling
    const contents = view.querySelectorAll('.tab-content');
    contents.forEach(c => {
        const isActive = c.id === `tab-${activeTabName}`;
        const tabName = c.id.startsWith('tab-') ? c.id.slice(4) : '';
        const owner = nav.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        c.setAttribute('role', 'tabpanel');
        c.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        if (owner && owner.id) {
            c.setAttribute('aria-labelledby', owner.id);
        }
        if (isActive) {
            c.classList.add('active');
            c.removeAttribute('hidden');
        } else {
            c.classList.remove('active');
            c.setAttribute('hidden', 'hidden');
        }
    });
}

export function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Ease Out Cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        const val = ease * (end - start) + start;
        obj.innerHTML = val.toFixed(1);
        if (progress < 1) window.requestAnimationFrame(step);
        else obj.innerHTML = end.toFixed(1);
    };
    window.requestAnimationFrame(step);
}
