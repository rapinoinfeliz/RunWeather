export function infoIcon(title, text) {
    const tSafe = title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const txtSafe = text.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    return `<span onclick="window.showInfoTooltip(event, '${tSafe}', '${txtSafe}')" style="cursor:pointer; opacity:0.5; margin-left:4px; display:inline-flex; vertical-align:middle;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span>`;
}

export function getImpactColor(pct) {
    if (pct < 0.5) return "#4ade80"; // Green
    if (pct < 2.0) return "#facc15"; // Yellow
    if (pct < 3.5) return "#fb923c"; // Orange
    if (pct < 6.0) return "#f87171"; // Red
    return "#c084fc"; // Purple
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
    const mode = window.currentPaceMode || 'HMP';
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

export function getDateFromWeek(w) {
    // 2025 starts on a Wednesday
    const date = new Date(2025, 0, 1 + (w - 1) * 7);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
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
