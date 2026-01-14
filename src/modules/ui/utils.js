export function infoIcon(title, text) {
    const tSafe = title.replace(/'/g, "\\'");
    const txtSafe = text.replace(/'/g, "\\'");
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
