
// UI Module - Reconstructed
import { HAPCalculator, VDOT_MATH, parseTime, formatTime, getEasyPace, getISOWeek } from './core.js';
import { calculatePacingState, calculateWBGT } from './engine.js';
import { fetchWeatherData, searchCity, fetchIpLocation, reverseGeocode } from './api.js';
import { saveToStorage } from './storage.js';
// Assuming core.js has HAPCalculator
// But app.js code used `window.hapCalc`.
// Assuming core.js has HAPCalculator
// But app.js code used `window.hapCalc`.
let forecastData = [];
// UI State Variables
let selectedImpactFilter = null;
let climateSortDir = 'asc';
let climateSortCol = 'date';
let climateImpactFilter = null;
let selectedClimateKey = null;
let forecastSortCol = 'time';
let forecastSortDir = 'asc';
let selectedForeHour = null;
let isDark = false; // Default light mode

// Expose these via window for legacy compatibility (read from window in funcs)
// OR just rely on module scope if functions use them directly.
// To support "window.selectedImpactFilter" style in existing code, we might need to sync them
// But based on errors, code is trying to read variable directly in module scope?
// "ReferenceError: selectedImpactFilter is not defined" suggests code uses bare variable.
// If code uses `window.selectedImpactFilter`, it wouldn't be RefErr (it would be undefined).

// Let's bind them to window as well for hybrid usage
window.selectedImpactFilter = null;
window.climateSortDir = 'asc';
window.climateSortCol = 'date';
window.climateImpactFilter = null;
window.selectedClimateKey = null;
window.forecastSortCol = 'time';
window.forecastSortDir = 'asc';
window.selectedForeHour = null;
window.isDark = false;

export function toggleDarkMode() {
    isDark = !isDark;
    window.isDark = isDark;
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    // Re-render things that depend on theme colors
    renderClimateHeatmap();
}
window.currentPaceMode = 'HMP'; // Default

export function setForecastData(d) { forecastData = d; }
let climateData = [];
export function setClimateData(d) {
    climateData = d;
    window.climateData = d;
}

// We will rely on window.hapCalc for now to minimize breakage inside the extracted blocks.


// --- Helpers ---
// infoIcon was local in renderCurrentTab, duplicating here for shared use if needed
// infoIcon was local in renderCurrentTab, duplicating here for shared use if needed
function infoIcon(title, text) {
    const tSafe = title.replace(/'/g, "\\'");
    const txtSafe = text.replace(/'/g, "\\'");
    return `<span onclick="window.showInfoTooltip(event, '${tSafe}', '${txtSafe}')" style="cursor:pointer; opacity:0.5; margin-left:4px; display:inline-flex; vertical-align:middle;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span>`;
}

function getBasePaceSec() {
    const mode = window.currentPaceMode || 'HMP';
    // Helper to parse times from elements
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

// date/time format helpers
// formatTime imported from core.js

function getDateFromWeek(w) {
    // 2025 starts on a Wednesday
    const date = new Date(2025, 0, 1 + (w - 1) * 7);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}


export function openTab(tabName, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');

    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Hide tooltip if exists
    const tooltip = document.getElementById('forecast-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.display = 'none'; // Force hide
    }
    if (window.hideForeTooltip) window.hideForeTooltip();

    // Trigger Chart Render if Forecast/Climate Tab
    if (tabName === 'climate' && window.renderClimateHeatmap) {
        setTimeout(window.renderClimateHeatmap, 50);
    }
    if ((tabName === 'forecast' || tabName === 'forecast16') && window.renderAllForecasts) {
        setTimeout(window.renderAllForecasts, 100);
    }
}

export function setPaceMode(mode) {
    window.currentPaceMode = mode;
    // Update Buttons (Sync across both tabs - now just one actually, but safe to keep)
    ['pace-tag-container-16'].forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            const btns = container.querySelectorAll('.tag-btn');
            btns.forEach(btn => {
                if (btn.dataset.mode === mode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    });
    renderAllForecasts();
}

export function toggleForeSort(col) {
    if (forecastSortCol === col) {
        forecastSortDir = (forecastSortDir === 'asc') ? 'desc' : 'asc';
    } else {
        forecastSortCol = col;
        forecastSortDir = 'desc'; // Default to high-to-low for most metrics (Temp, Impact, etc) make sense? 
        // Actually:
        // Time: asc default
        // Temp: desc (hotter first)
        // Impact: desc (worse first)
        // Wind: desc (stronger first)
        // But standard table UX usually defaults asc. Let's stick to standard toggle or smart default.
        // Let's standard toggle: if new col, default asc. 
        // User can click again.
        forecastSortDir = 'asc';
        if (['impact', 'temp', 'dew', 'wind', 'rain', 'prob'].includes(col)) forecastSortDir = 'desc';
    }
    renderAllForecasts();
}

export function setBestRunRange(range, event) {
    if (event) event.stopPropagation();
    window.selectedBestRunRange = range;

    // Update UI
    const btns = document.querySelectorAll('.insight-btn');
    btns.forEach(btn => {
        if (btn.innerText.toLowerCase() === range.toLowerCase()) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Recalculate
    calculateBestRunTime(forecastData);
}

// function renderAllForecasts() { ... moved to end of file ... }

export function toggleImpactFilter(cat) {
    if (selectedImpactFilter === cat) selectedImpactFilter = null;
    else selectedImpactFilter = cat;
    renderAllForecasts();
}

export function renderOverview() {
    // Placeholder if needed
}

export function getImpactCategory(pct) {
    if (pct < 0.5) return 'Ideal';
    if (pct < 2.0) return 'Good';
    if (pct < 3.5) return 'Fair';
    if (pct < 6.0) return 'Warning';
    return 'Severe';
}

export function sortForecastTable(col) {
    if (forecastSortCol === col) {
        forecastSortDir = forecastSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        forecastSortCol = col;
        forecastSortDir = 'asc';
    }
    renderAllForecasts();
}

export function handleCellHover(e, el) {
    const day = el.getAttribute('data-day');
    const hour = el.getAttribute('data-hour');
    const temp = el.getAttribute('data-temp');
    const dew = el.getAttribute('data-dew');
    const pct = el.getAttribute('data-pct');
    const color = el.getAttribute('data-color');

    const html = `
                        <div class="tooltip-header">${day} ${hour}:00</div>
                        <div class="tooltip-row"><span class="tooltip-label">Temp:</span> <span class="tooltip-val" style="color:#fff">${temp}°</span></div>
                        <div class="tooltip-row"><span class="tooltip-label">Dew:</span> <span class="tooltip-val" style="color:#60a5fa">${dew}°</span></div>
                        <div class="tooltip-row" style="margin-top:4px; padding-top:4px; border-top:1px solid #374151">
                            <span class="tooltip-label">Impact:</span> <span class="tooltip-val" style="color:${color}">${pct}%</span>
                        </div>
                    `;
    window.showForeTooltip(e, html);
}

export function showForeTooltip(e, htmlContent) {
    let el = document.getElementById('forecast-tooltip');
    // Create if missing
    if (!el) {
        el = document.createElement('div');
        el.id = 'forecast-tooltip';
        el.className = 'forecast-tooltip';
        // Add inline styles just in case CSS missed
        el.style.position = 'fixed'; // Use fixed for better reliability with scroll
        el.style.zIndex = '10000';
        document.body.appendChild(el);
    }
    el.innerHTML = htmlContent;
    el.style.display = 'block'; // Make sure it's visible if it was hidden
    el.style.opacity = '1';

    // Initial Position
    const w = el.offsetWidth;
    let x = e.clientX + 15;
    // Flip if overflow right
    if (x + w > window.innerWidth - 10) {
        x = e.clientX - w - 15;
    }
    const y = e.clientY - el.offsetHeight - 10;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

export function moveForeTooltip(e) {
    const el = document.getElementById('forecast-tooltip');
    if (el) {
        const w = el.offsetWidth;
        let x = e.clientX + 15;
        if (x + w > window.innerWidth - 10) {
            x = e.clientX - w - 15;
        }
        const y = e.clientY - el.offsetHeight - 10;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
    }
}

export function hideForeTooltip() {
    const el = document.getElementById('forecast-tooltip');
    if (el) el.style.opacity = '0';
}

export function getImpactColor(pct) {
    if (pct < 0.5) return "#4ade80"; // Green
    if (pct < 2.0) return "#facc15"; // Yellow
    if (pct < 3.5) return "#fb923c"; // Orange
    if (pct < 6.0) return "#f87171"; // Red
    return "#c084fc"; // Purple
}

export function getDewColor(d) {
    if (d < 15) return "var(--text-primary)"; // Comfortable
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

    const cCold = '#60a5fa'; // Blue for cold temps

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
        if (val >= 40) return cBad;
        if (val >= 25) return cWarn;
        if (val >= 15) return cFair;
        return cGood;
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

export function showInfoTooltip(e, title, text) {
    e.stopPropagation();
    let el = document.getElementById('forecast-tooltip');
    if (!el) {
        el = document.createElement('div');
        el.id = 'forecast-tooltip';
        el.className = 'forecast-tooltip';
        document.body.appendChild(el);
    }

    // Toggle: if already showing this tooltip, hide it
    if (el.style.opacity === '1' && el.dataset.currentTitle === title) {
        el.style.opacity = '0';
        el.style.display = 'none';
        el.dataset.currentTitle = '';
        return;
    }

    const html = `
                        <div style="font-weight:600; margin-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:4px;">${title}</div>
                        <div style="font-size:0.85em; opacity:0.9; line-height:1.4;">${text}</div>
                    `;

    el.innerHTML = html;
    el.style.display = 'block';
    el.style.opacity = '1';
    el.style.maxWidth = '200px';
    el.dataset.currentTitle = title;

    // Position
    const tooltipWidth = 200;
    let left = e.clientX + 10;
    if (left + tooltipWidth > window.innerWidth) {
        left = e.clientX - tooltipWidth - 10;
    }
    const top = e.clientY + 10;

    el.style.left = left + 'px';
    el.style.top = top + 'px';
}

export function renderCurrentTab(w, a, prob2h = 0, precip2h = 0, daily) {
    const container = document.getElementById('current-content');
    if (!container) return;

    // Metrics
    const safeVal = (v, dec = 1) => (v != null && !isNaN(v)) ? v.toFixed(dec) : '--';
    const rh = w.relative_humidity_2m;
    const feels = w.apparent_temperature;
    const wind = w.wind_speed_10m;
    const windGust = w.wind_gusts_10m || 0;
    const dir = w.wind_direction_10m; // degrees
    const rain = w.rain; // mm
    const precip = w.precipitation || 0;
    const uv = w.uv_index;
    const aqi = a ? a.us_aqi : '--';
    const pm25 = a ? a.pm2_5 : '--';

    // Convert Dir to Cardinal
    const getCardinal = (angle) => {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return directions[Math.round(angle / 45) % 8];
    };
    const windDirStr = getCardinal(dir);

    // --- WBGT Calculation (ACSM / BOM Estimation) ---
    // Moved to engine.js


    const wbgtVal = (w.shortwave_radiation != null) ? calculateWBGT(w.temperature_2m, w.relative_humidity_2m, w.wind_speed_10m, w.shortwave_radiation) : null;

    // --- New Metrics Calc ---
    const pressure = w.pressure_msl || 1013;

    // Run Score
    let runScore = 100;
    if (window.hapCalc) {
        const res = hapCalc.calculatePaceInHeat(300, w.temperature_2m, w.dew_point_2m);
        runScore = Math.max(0, Math.round(100 - (res.percentImpact * 12)));
    }
    const getScoreColor = (s) => s >= 90 ? '#4ade80' : s >= 75 ? '#a3e635' : s >= 60 ? '#facc15' : s >= 40 ? '#fb923c' : '#f87171';

    // Sweat Rate (Heuristic)
    const srBase = wbgtVal !== null ? wbgtVal : feels;
    let sweatRate = 1.0 + (srBase - 20) * 0.05;
    if (sweatRate < 0.4) sweatRate = 0.4;

    // WBGT Color & Risk
    const getWBGTColor = (val) => {
        if (val < 18) return '#4ade80'; // Green (Low)
        if (val < 21) return '#facc15'; // Yellow (Moderate)
        if (val < 25) return '#fb923c'; // Orange (High)
        if (val < 28) return '#f87171'; // Red (Very High)
        return '#c084fc'; // Purple (Extreme)
    };
    const getWBGTText = (val) => {
        if (val < 18) return 'Low Risk';
        if (val < 21) return 'Mod. Risk'; // Adjusted for runner sensitivity
        if (val < 25) return 'High Risk';
        if (val < 28) return 'Very High';
        if (val < 30) return 'Extreme';
        return 'CANCEL';
    };




    // Styles
    const outerGridStyle = "display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; justify-items:center;";
    const cardStyle = "background:var(--card-bg); padding:16px; border-radius:12px; border:1px solid var(--border-color); width:100%;";
    const headStyle = "font-size:0.9rem; font-weight:600; color:var(--text-primary); margin-bottom:12px; display:flex; align-items:center; gap:6px;";
    const gridStyle = "display:grid; grid-template-columns: 1fr 1fr; gap:12px; row-gap:16px; align-items: stretch;";
    const itemStyle = "display:flex; flex-direction:column; justify-content:space-between; height:100%;";
    const labelStyle = "font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px;";
    const valStyle = "font-size:1.1rem; font-weight:500; color:var(--text-primary); margin-top:auto;";

    // sectionStyle is now cardStyle conceptually, but keeping name for minimal changes
    const sectionStyle = "background:var(--card-bg); padding:16px; border-radius:12px; border:1px solid var(--border-color);";

    let html = '';

    // Helper for info icon
    const infoIcon = (title, text) => {
        const tSafe = title.replace(/'/g, "\\'");
        const txtSafe = text.replace(/'/g, "\\'");
        return `<span onclick="window.showInfoTooltip(event, '${tSafe}', '${txtSafe}')" style="cursor:pointer; opacity:0.5; margin-left:4px; display:inline-flex; vertical-align:middle;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span>`;
    };

    // 1. Temperature Section (WBGT Integrated)
    html += `<div style="${sectionStyle}">
                        <div style="${headStyle}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"></path></svg> Temperature</div>
                        <div style="${gridStyle}">
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Air ${infoIcon('Air Temperature', 'The dry-bulb temperature. Does not account for humidity or wind.<br><br><span style=&quot;color:#60a5fa&quot;><b>< 10°C (Cold):</b></span> Cool for running.<br><span style=&quot;color:#4ade80&quot;><b>10-28°C (Ideal):</b></span> Optimal range.<br><span style=&quot;color:#fb923c&quot;><b>28-32°C (Hot):</b></span> Pace impact.<br><span style=&quot;color:#f87171&quot;><b>32-35°C (Very Hot):</b></span> High risk.<br><span style=&quot;color:#c084fc&quot;><b>> 35°C (Extreme):</b></span> Dangerous.')}</div>
                                <div style="${valStyle}; color:${getCondColor('air', w.temperature_2m)}">${safeVal(w.temperature_2m)} <span style="font-size:0.8em">°C</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">WBGT ${infoIcon('WBGT (Wet Bulb Globe Temp)', 'The Gold Standard for heat safety. Accounts for Temp, Humidity, Wind AND Solar Radiation.<br><br><span style=&quot;color:#4ade80&quot;><b>< 18°C (Low Risk):</b></span> Safe. Hard efforts OK.<br><span style=&quot;color:#facc15&quot;><b>18-21°C (Moderate):</b></span> Caution. Hydrate more.<br><span style=&quot;color:#fb923c&quot;><b>21-25°C (High):</b></span> Slow down. Heat cramps risk.<br><span style=&quot;color:#f87171&quot;><b>25-28°C (Very High):</b></span> Dangerous. Limit intensity.<br><span style=&quot;color:#c084fc&quot;><b>> 28°C (Extreme):</b></span> Cancel hard runs. Survival mode.')}</div>
                                <div style="${valStyle}; color:${wbgtVal !== null ? getWBGTColor(wbgtVal) : getCondColor('air', feels)}">
                                    ${wbgtVal !== null ? wbgtVal.toFixed(1) : safeVal(feels)} <span style="font-size:0.8em">°C</span>
                                </div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Dew Point ${infoIcon('Dew Point', 'The absolute measure of moisture in the air. The critical metric for runner comfort.<br><br><span style=&quot;color:#4ade80&quot;><b>< 15°C (Comfortable):</b></span> Crisp.<br><span style=&quot;color:#facc15&quot;><b>15-20°C (Humid):</b></span> Noticeable.<br><span style=&quot;color:#fb923c&quot;><b>20-24°C (Uncomfortable):</b></span> Hard.<br><span style=&quot;color:#f87171&quot;><b>> 24°C (Oppressive):</b></span> Very High Risk.')}</div>
                                <div style="${valStyle}; color:${getDewColor(w.dew_point_2m)}">${safeVal(w.dew_point_2m)} <span style="font-size:0.8em">°C</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Humidity ${infoIcon('Relative Humidity', 'Relative saturation of the air. High humidity hinders sweat evaporation.<br><br><span style=&quot;color:#4ade80&quot;><b>< 75% (OK):</b></span> Good evaporation.<br><span style=&quot;color:#fb923c&quot;><b>75-90% (Sticky):</b></span> Sweat drips.<br><span style=&quot;color:#f87171&quot;><b>> 90% (Oppressive):</b></span> No evaporation.')}</div>
                                <div style="${valStyle}; color:${getCondColor('hum', rh)}">${safeVal(rh, 0)} <span style="font-size:0.8em">%</span></div>
                            </div>
                        </div>
                    </div>`;

    // 2. Wind & Precip
    // 2. Wind
    html += `<div style="${sectionStyle}">
                        <div style="${headStyle}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg> Wind</div>
                        <div style="${gridStyle}">
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Speed ${infoIcon('Wind Speed', 'Sustained wind speed at 10m height.<br><br><span style=&quot;color:#4ade80&quot;><b>< 15 km/h (Light):</b></span> Negligible.<br><span style=&quot;color:#facc15&quot;><b>15-24 km/h (Moderate):</b></span> Noticeable.<br><span style=&quot;color:#fb923c&quot;><b>25-39 km/h (High):</b></span> Significant drag.<br><span style=&quot;color:#f87171&quot;><b>40+ km/h (Severe):</b></span> Stormy.')}</div>
                                <div style="${valStyle}; color:${getCondColor('wind', wind)}">${safeVal(wind)} <span style="font-size:0.7em">km/h</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Gusts ${infoIcon('Wind Gusts', 'Maximum instantaneous wind speed at 10 meters.')}</div>
                                <div style="${valStyle}; color:${getCondColor('wind', windGust)}">${safeVal(windGust)} <span style="font-size:0.7em">km/h</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Direction</div>
                                <div style="${valStyle}">${windDirStr} <span style="font-size:0.7em; color:var(--text-secondary);">(${dir}°)</span></div>
                            </div>
                        </div>
                    </div>`;

    html += `<div style="${sectionStyle}">
                        <div style="${headStyle}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="16" y1="13" x2="16" y2="21"></line><line x1="8" y1="13" x2="8" y2="21"></line><line x1="12" y1="15" x2="12" y2="23"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg> Precipitation</div>
                        <div style="${gridStyle}">
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Rain (2h) ${infoIcon('Rain Forecast', 'Estimated total precipitation currently expected for the next 2 hours.')}</div>
                                <div style="${valStyle}">${safeVal(precip2h)} <span style="font-size:0.7em">mm</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Chance ${infoIcon('Rain Probability', 'Probability of precipitation.<br><br><span style=&quot;color:#4ade80&quot;><b>< 30% (Low):</b></span> Unlikely.<br><span style=&quot;color:#fb923c&quot;><b>30-60% (Medium):</b></span> Possible.<br><span style=&quot;color:#f87171&quot;><b>> 60% (High):</b></span> Look for shelter.')}</div>
                                <div style="${valStyle}; color:${getCondColor('prob', prob2h)}">${prob2h} <span style="font-size:0.7em">%</span></div>
                            </div>
                        </div>
                    </div>`;

    // 4. Radiation & Air
    // Remove local aqiColor logic in favor of getCondColor helper

    html += `<div style="${sectionStyle}">
                        <div style="${headStyle}"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg> Radiation & Air</div>
                        <div style="${gridStyle} grid-template-columns: 1fr 1fr 1fr;">
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">UV Index ${infoIcon('UV Index (WHO)', 'Strength of sunburn-producing UV radiation.<br><br><span style=&quot;color:#4ade80&quot;><b>0-2 (Low):</b></span> Safe.<br><span style=&quot;color:#facc15&quot;><b>3-5 (Mod):</b></span> Sunscreen.<br><span style=&quot;color:#fb923c&quot;><b>6-7 (High):</b></span> Cover up.<br><span style=&quot;color:#f87171&quot;><b>8-10 (Very High):</b></span> Shade.<br><span style=&quot;color:#c084fc&quot;><b>11+ (Extreme):</b></span> Stay inside.')}</div>
                                <div style="${valStyle}; color:${getCondColor('uv', uv)}">${safeVal(uv, 2)}</div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">AQI ${infoIcon('US AQI (EPA)', 'Index for reporting daily air quality.<br><br><span style=&quot;color:#4ade80&quot;><b>0-50 (Good):</b></span> Breath easy.<br><span style=&quot;color:#facc15&quot;><b>51-100 (Mod):</b></span> Acceptable.<br><span style=&quot;color:#fb923c&quot;><b>101-150 (Sensitive):</b></span> Asthma risk.<br><span style=&quot;color:#f87171&quot;><b>151+ (Unhealthy):</b></span> Bad for all.')}</div>
                                <div style="${valStyle}; color:${getCondColor('aqi', aqi)}">${aqi}</div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">PM2.5 ${infoIcon('PM2.5 (EPA)', 'Fine particles (<2.5µm) that penetrate lungs.<br><br><span style=&quot;color:#4ade80&quot;><b>0-12 (Good):</b></span> Clear.<br><span style=&quot;color:#fb923c&quot;><b>12-35 (Mod):</b></span> Haze.<br><span style=&quot;color:#f87171&quot;><b>35+ (Unhealthy):</b></span> Mask up.')}</div>
                                <div style="${valStyle}; color:${getCondColor('pm25', pm25)}">${pm25} <span style="font-size:0.7em">µg</span></div>
                            </div>
                        </div>
                    </div>`;



    // 5. Sun Cycle
    if (daily) {
        const fmtTime = (iso) => iso ? iso.substring(11, 16) : '--:--';

        // Helper: Add minutes to HH:MM string directly
        const shiftTime = (timeStr, deltaMin) => {
            if (!timeStr || timeStr === '--:--') return '--:--';
            const parts = timeStr.split(':');
            let h = parseInt(parts[0], 10);
            let m = parseInt(parts[1], 10);

            let total = h * 60 + m + deltaMin;
            if (total < 0) total += 1440; // wrap around day
            if (total >= 1440) total -= 1440;

            const newH = Math.floor(total / 60);
            const newM = total % 60;
            return String(newH).padStart(2, '0') + ':' + String(newM).padStart(2, '0');
        };

        // 5. Sun Cycle (Solar Horizon Graph)
        {
            // Parse times to minutes
            const toMin = (str) => {
                if (!str) return 0;
                const p = str.split(':').map(Number);
                return p[0] * 60 + p[1];
            };

            // Restore definitions
            const sunrise = fmtTime(daily.sunrise ? daily.sunrise[0] : null);
            const sunset = fmtTime(daily.sunset ? daily.sunset[0] : null);
            const dawn = shiftTime(sunrise, -25);
            const dusk = shiftTime(sunset, 25);

            const dawnMin = toMin(dawn);
            const sunriseMin = toMin(sunrise);
            const sunsetMin = toMin(sunset);
            const duskMin = toMin(dusk);

            // Current time in minutes
            const nowD = new Date();
            const nowMin = nowD.getHours() * 60 + nowD.getMinutes();

            // New Stats
            const totalDayMin = sunsetMin - sunriseMin;

            // Remaining daylight (sunset - now)
            const remainingMin = Math.max(0, sunsetMin - nowMin);
            const remHours = Math.floor(remainingMin / 60);
            const remM = remainingMin % 60;
            const daylightStr = remainingMin > 0 ? `${remHours}h ${remM}m left` : 'Night';

            const solarNoonMin = sunriseMin + (totalDayMin / 2);
            const noonH = Math.floor(solarNoonMin / 60);
            const noonM = Math.floor(solarNoonMin % 60);
            const solarNoonStr = `${String(noonH).padStart(2, '0')}:${String(noonM).padStart(2, '0')}`;

            // Graph Scales (ViewBox 300 x 60)
            const scaleX = (m) => (m / 1440) * 300;
            const yHorizon = 50;

            const xSunrise = scaleX(sunriseMin);
            const xSunset = scaleX(sunsetMin);
            const xNoon = scaleX(solarNoonMin);
            const xNow = scaleX(nowMin);

            html += `<div class="solar-card" style="${sectionStyle}">
                            <div style="${headStyle}">
                                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                                Solar Cycle
                                <span style="margin-left:auto; font-size:0.75em; font-weight:normal; color:var(--text-secondary);">${daylightStr}</span>
                            </div>
                            
                            <!-- Minimalist Arc Graph -->
                            <div style="position:relative; width:100%; height:50px; margin:8px 0;">
                                <svg viewBox="0 0 300 50" width="100%" height="100%" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="dayGradMin" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stop-color="#facc15" stop-opacity="0.2"/>
                                            <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
                                        </linearGradient>
                                    </defs>
                                    <!-- Horizon Line -->
                                    <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
                                    <!-- Sun Arc -->
                                    <path d="M ${xSunrise},40 Q ${xNoon},5 ${xSunset},40" fill="url(#dayGradMin)" stroke="rgba(250,204,21,0.4)" stroke-width="1" />
                                    <!-- Current Position - Discreet tick -->
                                    <line x1="${xNow}" y1="38" x2="${xNow}" y2="42" stroke="var(--accent-color)" stroke-width="1" opacity="${nowMin >= sunriseMin && nowMin <= sunsetMin ? 0.6 : 0.2}" />
                                </svg>
                            </div>
                            
                            <!-- Sunrise/Sunset Times -->
                            <div style="display:flex; justify-content:space-between; font-size:0.85em; color:var(--text-secondary);">
                                <div>
                                    <div style="color:var(--text-primary); font-weight:500;">${sunrise}</div>
                                    <div style="font-size:0.8em;">Dawn ${dawn}</div>
                                </div>
                                <div style="text-align:center;">
                                    <div style="font-size:0.7em; opacity:0.7;">NOON</div>
                                    <div style="color:var(--text-primary); font-weight:500;">${solarNoonStr}</div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="color:var(--text-primary); font-weight:500;">${sunset}</div>
                                    <div style="font-size:0.8em;">Dusk ${dusk}</div>
                                </div>
                            </div>
                        </div>`;
        }


    }

    // 6. Live Map Module (Windy)

    // Wrap all cards in 2-column grid with centered odd item
    const gridWrapper = `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">`;
    const gridEnd = `</div><style>.current-cards-grid > div:last-child:nth-child(odd) { grid-column: 1 / -1; max-width: 50%; justify-self: center; }</style>`;

    container.innerHTML = gridWrapper + html + gridEnd;
    container.querySelector('div').classList.add('current-cards-grid');
}

export function toggleForeSelection(isoTime, e) {
    if (e) e.stopPropagation();
    if (isoTime === null) {
        selectedForeHour = null;
        window.selectedForeHour = null;
    } else {
        if (selectedForeHour === isoTime) {
            selectedForeHour = null;
            window.selectedForeHour = null;
        } else {
            selectedForeHour = isoTime;
            window.selectedForeHour = isoTime;
        }
    }
    renderAllForecasts();
}



export function renderForecastChart(containerId, dayLimit) {
    const cont = document.getElementById(containerId || 'forecast-chart-container');
    if (!cont || !forecastData || forecastData.length === 0) return;

    // Data Slicing
    let chartData = forecastData;
    if (dayLimit) {
        chartData = forecastData.slice(0, 24 * dayLimit);
    }

    // Dimensions (Responsive)
    // Use clientWidth but wait for layout if possible?
    const w = cont.clientWidth;
    const h = 180; // Fixed height
    if (w === 0) return; // Not visible yet

    const pad = { top: 20, right: 10, bottom: 20, left: 30 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    // Scales
    const temps = chartData.map(d => d.temp);
    const dews = chartData.map(d => d.dew);
    const allVals = [...temps, ...dews];
    let minVal = Math.min(...allVals);
    let maxVal = Math.max(...allVals);
    minVal = Math.floor(minVal - 2);
    maxVal = Math.ceil(maxVal + 2);
    const valRange = maxVal - minVal;

    const getX = (i) => pad.left + (i / (chartData.length - 1)) * chartW;
    const getY = (val) => pad.top + chartH - ((val - minVal) / valRange) * chartH;

    // Paths
    // Paths (Handle Gaps for Null Data)
    let pathTemp = '';
    let pathDew = '';
    let hasStartedTemp = false;
    let hasStartedDew = false;

    chartData.forEach((d, i) => {
        const x = getX(i);

        // Temp Path
        if (d.temp != null) {
            const yT = getY(d.temp);
            const cmd = hasStartedTemp ? 'L' : 'M';
            pathTemp += `${cmd} ${x.toFixed(1)} ${yT.toFixed(1)} `;
            hasStartedTemp = true;
        } else {
            hasStartedTemp = false; // Break the line
        }

        // Dew Path
        if (d.dew != null) {
            const yD = getY(d.dew);
            const cmd = hasStartedDew ? 'L' : 'M';
            pathDew += `${cmd} ${x.toFixed(1)} ${yD.toFixed(1)} `;
            hasStartedDew = true;
        } else {
            hasStartedDew = false; // Break the line
        }
    });

    // Build SVG
    let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="cursor:crosshair;">`;

    // Grid & Labels
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        const val = minVal + (valRange * (i / steps));
        const y = getY(val);
        svg += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4 4" opacity="0.3" style="pointer-events:none;" />`;
        svg += `<text x="${pad.left - 5}" y="${y + 3}" fill="var(--text-secondary)" font-size="9" text-anchor="end" style="pointer-events:none;">${Math.round(val)}</text>`;
    }

    // Days Delimiter (Midnight) & Labels (Noon)
    chartData.forEach((d, i) => {
        const date = new Date(d.time);
        const hour = parseInt(d.time.substring(11, 13)); // Robust parsing
        const x = getX(i);

        // Midnight Line
        if (hour === 0 && i > 0) {
            svg += `<line x1="${x}" y1="${pad.top}" x2="${x}" y2="${h - pad.bottom}" stroke="var(--border-color)" stroke-width="1" opacity="0.3" />`;
        }

        // Noon Label (Centered)
        if (hour === 12) {
            svg += `<text x="${x}" y="${h - 5}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${date.toLocaleDateString('en-US', { weekday: 'short' })}</text>`;
        }
    });

    // Selected Hour Highlight
    let selectedX = -1;
    if (selectedForeHour) {
        const idx = forecastData.findIndex(d => d.time === selectedForeHour);
        if (idx !== -1) {
            selectedX = getX(idx);
            svg += `<line x1="${selectedX}" y1="${pad.top}" x2="${selectedX}" y2="${h - pad.bottom}" stroke="var(--accent-color)" stroke-width="2" opacity="0.8" />`;
            // Highlight Dots
            const d = forecastData[idx];
            svg += `<circle cx="${selectedX}" cy="${getY(d.temp)}" r="4" fill="#f87171" stroke="white" stroke-width="2"/>`;
            svg += `<circle cx="${selectedX}" cy="${getY(d.dew)}" r="4" fill="#60a5fa" stroke="white" stroke-width="2"/>`;
        }
    }

    // Paths
    svg += `<path d="${pathDew}" fill="none" stroke="#60a5fa" stroke-width="2" />`;
    svg += `<path d="${pathTemp}" fill="none" stroke="#f87171" stroke-width="2" />`;

    // Interaction Layer (Transparent)
    // We attach mouse events to the parent div or this rect
    // Easier to use inline events on rect for quick implementation
    svg += `<rect x="${pad.left}" y="${pad.top}" width="${chartW}" height="${chartH}" fill="white" fill-opacity="0" 
                            data-action="chart-interact"
                            data-total-w="${w}"
                            data-chart-w="${chartW}"
                            data-pad-left="${pad.left}"
                            data-len="${chartData.length}" />`;

    svg += `</svg>`;
    cont.innerHTML = svg;
}

export function toggleVDOTDetails() {
    const el = document.getElementById('vdot-details');
    if (!el) return;

    if (el.style.display === 'none') {
        el.style.display = 'block';
        renderVDOTDetails();
    } else {
        el.style.display = 'none';
    }
}

export function handleChartHover(e, totalW, chartW, padLeft, dataLen) {
    const rect = e.target.getBoundingClientRect();
    // Adjust mouseX to be relative to the chart area (padLeft offset)
    // The SVG rect element starts at pad.left, so e.clientX on it is relative to viewport.
    const rectBounds = e.target.getBoundingClientRect();
    const x = e.clientX - rectBounds.left;
    const ratio = x / rectBounds.width;
    const len = dataLen || forecastData.length;
    let idx = Math.round(ratio * (len - 1));
    idx = Math.max(0, Math.min(idx, len - 1)); // Clamp to bounds

    if (idx >= 0 && idx < forecastData.length) {
        const d = forecastData[idx];

        // Calculate Impact for consistency
        const mode = window.currentPaceMode || 'HMP';

        // Calculate Impact for consistency
        let baseSec = getBasePaceSec();

        const adjPace = hapCalc.calculatePaceInHeat(baseSec, d.temp, d.dew);
        const pct = ((adjPace - baseSec) / baseSec) * 100;
        const color = getImpactColor(pct);

        const date = new Date(d.time);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        // Add combined day/month
        const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        const hourStr = d.time.substring(11, 13); // Force string usage

        // Exact same HTML template as handleCellHover
        const html = `
                            <div class="tooltip-header">${dayName} ${dateStr} ${hourStr}:00</div>
                            <div class="tooltip-row"><span class="tooltip-label">Temp:</span> <span class="tooltip-val" style="color:#fff">${d.temp != null ? d.temp.toFixed(1) : '--'}°</span></div>
                            <div class="tooltip-row"><span class="tooltip-label">Dew:</span> <span class="tooltip-val" style="color:#60a5fa">${d.dew != null ? d.dew.toFixed(1) : '--'}°</span></div>
                            <div class="tooltip-row" style="margin-top:4px; padding-top:4px; border-top:1px solid #374151">
                                <span class="tooltip-label">Impact:</span> <span class="tooltip-val" style="color:${color}">${pct.toFixed(2)}%</span>
                            </div>
                        `;
        window.showForeTooltip(e, html);
    }
}

export function handleChartClick(e, totalW, chartW, padLeft, dataLen) {
    const rect = e.target.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = mouseX / chartW;
    const len = dataLen || forecastData.length;
    const idx = Math.round(ratio * (len - 1));

    if (idx >= 0 && idx < forecastData.length) {
        const d = forecastData[idx];
        window.toggleForeSelection(d.time, e);
    }
}



export function showClimateTooltip(e, w, h, impact, temp, dew, count) {
    // Reuse the same tooltip element as Forecast for consistency
    let el = document.getElementById('forecast-tooltip');
    if (!el) {
        el = document.createElement('div');
        el.id = 'forecast-tooltip';
        el.className = 'forecast-tooltip';
        el.style.position = 'fixed';
        el.style.zIndex = '10000';
        document.body.appendChild(el);
    }

    // Match impact color logic
    let impactColor = "#4ade80";
    if (impact >= 6.0) impactColor = "#c084fc";
    else if (impact >= 3.5) impactColor = "#f87171";
    else if (impact >= 2.0) impactColor = "#fb923c";
    else if (impact >= 0.5) impactColor = "#facc15";

    const dateStr = `${getDateFromWeek(w)}`;
    const timeStr = `${String(h).padStart(2, '0')}:00`;

    // Exact HTML template as handleCellHover
    // Exact HTML template as handleCellHover
    const html = `
                    <div class="tooltip-header">Week ${w} (${dateStr}) ${timeStr}</div>
                    <div class="tooltip-row"><span class="tooltip-label">Temp:</span> <span class="tooltip-val" style="color:#fff">${(temp || 0).toFixed(1)}°</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Dew:</span> <span class="tooltip-val" style="color:#60a5fa">${(dew || 0).toFixed(1)}°</span></div>
                    <div class="tooltip-row" style="margin-top:4px; padding-top:4px; border-top:1px solid #374151">
                        <span class="tooltip-label">Impact:</span> <span class="tooltip-val" style="color:${impactColor}">${(impact || 0).toFixed(2)}%</span>
                    </div>
                `;

    el.innerHTML = html;
    el.style.display = 'block';
    el.style.opacity = '1';

    // Initial Position (Reusing logic from showForeTooltip/moveForeTooltip is best, but inline here works)
    window.moveClimateTooltip(e);
}

export function moveClimateTooltip(e) {
    const el = document.getElementById('forecast-tooltip');
    if (!el) return;

    const w = el.offsetWidth;
    let x = e.clientX + 15;
    if (x + w > window.innerWidth - 10) {
        x = e.clientX - w - 15;
    }
    const y = e.clientY - el.offsetHeight - 10;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

export function hideClimateTooltip() {
    const el = document.getElementById('forecast-tooltip');
    if (el) el.style.opacity = '0';
}

export function filterClimateByImpact(idx, el) {
    if (climateImpactFilter === idx) {
        climateImpactFilter = null;
        window.climateImpactFilter = null;
        // Clear dimming
        if (el && el.parentElement) el.parentElement.querySelectorAll('.legend-item').forEach(e => e.classList.remove('opacity-20'));
    } else {
        climateImpactFilter = idx;
        window.climateImpactFilter = idx;
        // Set dimming
        if (el && el.parentElement) {
            el.parentElement.querySelectorAll('.legend-item').forEach(e => e.classList.add('opacity-20'));
            el.classList.remove('opacity-20');
        }
    }
    renderClimateHeatmap(); // To dim cells
    renderClimateTable();   // To filter rows
}

export function renderClimateTable() {
    const tb = document.getElementById('climateTableBody');
    if (!tb) return;

    let data = (climateData || window.climateData || []).slice();

    // Filter
    if (selectedClimateKey) {
        const [selW, selH] = selectedClimateKey.split('-').map(Number);
        data = data.filter(d => d.week === selW && d.hour === selH);

        // Show Filter Label
        document.getElementById('climate-filter-label').classList.remove('hidden');
        document.getElementById('climate-filter-label').innerText = `Week ${selW}, ${selH}:00`;
        document.getElementById('climate-clear-filter').classList.remove('hidden');
    } else {
        document.getElementById('climate-filter-label').classList.add('hidden');
        document.getElementById('climate-clear-filter').classList.add('hidden');
    }

    // Sort
    const dir = climateSortDir === 'asc' ? 1 : -1;

    // Reset Icons
    document.querySelectorAll('[id^="sort-icon-climate-"]').forEach(el => el.innerText = '');
    const icon = dir === 1 ? '▲' : '▼';
    const iconEl = document.getElementById('sort-icon-climate-' + climateSortCol);
    if (iconEl) iconEl.innerText = ' ' + icon;

    data.sort((a, b) => {
        let valA, valB;
        if (climateSortCol === 'date') { valA = a.week; valB = b.week; } // Week proxy
        else if (climateSortCol === 'hour') { valA = a.hour; valB = b.hour; }
        else if (climateSortCol === 'temp') { valA = a.mean_temp; valB = b.mean_temp; }
        else if (climateSortCol === 'dew') { valA = a.mean_dew; valB = b.mean_dew; }
        else if (climateSortCol === 'wind') { valA = a.mean_wind; valB = b.mean_wind; }
        else if (climateSortCol === 'precip') { valA = a.mean_precip; valB = b.mean_precip; }
        else if (climateSortCol === 'impact') { valA = a.mean_impact; valB = b.mean_impact; }

        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    });

    tb.innerHTML = data.map(d => {
        const dateStr = getDateFromWeek(d.week);
        // Match Forecast Table Logic
        const timeStr = `${String(d.hour).padStart(2, '0')}:00`;

        let impactColor = "#4ade80";
        if (d.mean_impact >= 6.0) impactColor = "#c084fc";
        else if (d.mean_impact >= 3.5) impactColor = "#f87171";
        else if (d.mean_impact >= 2.0) impactColor = "#fb923c";
        else if (d.mean_impact >= 0.5) impactColor = "#facc15";

        if (climateImpactFilter !== null) {
            const catIdx = getImpactCategory(d.mean_impact);
            // console.log("Filtering:", { val: d.mean_impact, cat: catIdx, filter: climateImpactFilter });
            if (catIdx !== climateImpactFilter) return '';
        }

        // Rain/Wind logic similar to Forecast
        const rainColor = d.mean_precip > 0 ? '#60a5fa' : 'inherit';
        const tempColor = window.getCondColor ? window.getCondColor('air', d.mean_temp) : 'inherit';
        const dewColor = window.getDewColor ? window.getDewColor(d.mean_dew || 0) : 'inherit';
        const windColor = window.getCondColor ? window.getCondColor('wind', d.mean_wind || 0) : 'inherit';

        // Match Forecast Table Row structure exactly
        return `
            <tr style="${window.selectedClimateKey === `${d.week}-${d.hour}` ? 'background:var(--card-bg); font-weight:bold;' : ''}">
                <td style="padding:10px; color:var(--text-secondary); white-space:nowrap;">
                    <div style="font-size:0.75em;">${dateStr}</div>
                    <div style="font-size:1em; color:var(--text-primary); font-weight:500;">${timeStr}</div>
                </td>
                <td style="text-align:center; color:${tempColor}">${(d.mean_temp != null ? d.mean_temp : 0).toFixed(1)}°</td>
                <td style="text-align:center; color:${dewColor}">${(d.mean_dew != null ? d.mean_dew : 0).toFixed(1)}°</td>
                <td style="text-align:center; color:${rainColor}">${d.mean_precip > 0 ? (d.mean_precip || 0).toFixed(2) + 'mm' : '-'}</td>
                <td style="text-align:center; color:${windColor}">${(d.mean_wind || 0).toFixed(1)} <span style="font-size:0.7em;color:var(--text-secondary)">km/h</span></td>
                <td style="text-align:center;">
                    <span class="impact-badge" style="background:${impactColor}; color:#000; font-weight:600;">
                        ${(d.mean_impact || 0).toFixed(2)}%
                    </span>
                </td>
            </tr>`;
    }).join('');
}

export function renderClimateLegend() {
    const container = document.getElementById('climate-legend-container');
    if (!container) return;

    const levels = [
        { label: 'Ideal', sub: '<0.5%', color: '#4ade80' },
        { label: 'Good', sub: '<2.0%', color: '#facc15' },
        { label: 'Fair', sub: '<3.5%', color: '#fb923c' },
        { label: 'Warning', sub: '<6.0%', color: '#f87171' },
        { label: 'Severe', sub: '>6.0%', color: '#c084fc' }
    ];

    let html = '';

    levels.forEach((l) => {
        let opacity = '1';
        if (climateImpactFilter !== null && climateImpactFilter !== l.label) {
            opacity = '0.4';
        }

        let border = '1px solid transparent';
        let isActive = (climateImpactFilter === l.label);
        if (isActive) border = '2px solid #fff';

        html += `
                        <div class="legend-item" onclick="window.filterClimateByImpact('${l.label}', this)" style="cursor:pointer; opacity:${opacity}; transition:all 0.2s;">
                            <div class="legend-color" style="background-color:${l.color}; border:${border}; box-shadow: ${isActive ? '0 0 8px ' + l.color : 'none'};"></div>
                            <span>${l.label} <span style="font-size:0.75em; opacity:0.7">(${l.sub})</span></span>
                        </div>
                    `;
    });

    container.innerHTML = html;
}

export function sortClimate(col) {
    if (climateSortCol === col) {
        climateSortDir = (climateSortDir === 'asc') ? 'desc' : 'asc';
    } else {
        climateSortCol = col;
        climateSortDir = 'desc'; // Default high impact/temp first
        if (col === 'date' || col === 'hour') climateSortDir = 'asc';
    }
    renderClimateTable();
}

export function toggleClimateFilter(w, h, e) {
    if (e) e.stopPropagation(); // Essential to prevent document click from clearing selection immediately

    if (w === null) {
        selectedClimateKey = null;
        window.selectedClimateKey = null;
    } else {
        const key = `${w}-${h}`;
        if (selectedClimateKey === key) {
            selectedClimateKey = null;
            window.selectedClimateKey = null;
        } else {
            selectedClimateKey = key;
            window.selectedClimateKey = key;
        }
    }
    renderClimateTable();
    renderClimateHeatmap(); // Update opacity
    renderClimateLegend(); // Update legend
}

export function renderClimateHeatmap(data) {
    const container = document.getElementById('climate-heatmap-container');
    if (!container) return;

    // Use passed data, or module state, or window fallback
    const rawData = data || climateData || window.climateData;

    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
        // Only warn if we actually expected data (e.g. not just initial load)
        // But for now, let's just show loading text
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-secondary);">No climate data available yet.</div>';
        return;
    }

    // Optimization: Create a lookup map
    const dataMap = new Map();
    rawData.forEach(d => {
        dataMap.set(`${d.week}-${d.hour}`, d);
    });

    // Remove grid CSS if it persists and force simple block
    container.style.display = 'block';
    container.style.gridTemplateColumns = 'none';

    // ensure table is updated (initially)
    renderClimateTable();
    renderClimateLegend(); // Update legend

    // Calculate Current Time for Highlight
    const now = new Date();
    const curH = now.getHours();
    const curW = getISOWeek(now);

    // Dimensions
    const cellW = 12; // Base unit
    const cellH = 12;
    const gap = 2;
    const labelW = 40; // Left margin for Hour Labels
    const headerH = 24; // Top margin for Month Labels (Increased for visibility)

    // 53 Weeks x 24 Hours
    const cols = 53;
    const rows = 24;

    const totalW = labelW + (cols * (cellW + gap));
    const totalH = headerH + (rows * (cellH + gap));

    let svgInner = '';

    // 1. Month Labels (Correct Logic)
    // Use local date calculation to get Month name (getDateFromWeek returns string, we need Date)
    let lastMonth = "";
    for (let w = 1; w <= cols; w++) {
        const d = new Date(2025, 0, 1 + (w - 1) * 7);
        const m = d.toLocaleString('en-US', { month: 'short' });

        if (m !== lastMonth) {
            const x = labelW + ((w - 1) * (cellW + gap));
            // Adjust y to be nicely aligned within headerH (24px)
            // headerH is top margin. y=headerH is grid start. Labels should be at y ~ 16-18
            svgInner += `<text x="${x}" y="${headerH - 6}" font-size="9" fill="var(--text-secondary)">${m}</text>`;
            lastMonth = m;
        }
    }

    // 2. Hour Labels (Left) - Show ALL 24h
    for (let h = 0; h < 24; h++) {
        const y = headerH + (h * (cellH + gap)) + (cellH / 2) + 3;
        svgInner += `<text x="${labelW - 6}" y="${y}" text-anchor="end" font-size="9" fill="var(--text-secondary)">${h}</text>`;
    }

    // 3. Cells
    // Iterate Columns (Weeks) then Rows (Hours)
    for (let w = 1; w <= cols; w++) {
        for (let h = 0; h < rows; h++) {
            // Find data O(1)
            const pt = dataMap.get(`${w}-${h}`);

            const x = labelW + ((w - 1) * (cellW + gap));
            const y = headerH + (h * (cellH + gap));

            let color = 'transparent';
            let opacity = '1';
            let stroke = '';

            // Dimming Logic (Filter by Selection)
            if (window.selectedClimateKey) {
                const [sw, sh] = window.selectedClimateKey.split('-').map(Number);
                if (sw !== w || sh !== h) opacity = '0.1';
            } else if (climateImpactFilter !== null) {
                // If filter is active, check data
                if (!pt) {
                    opacity = '0.1';
                } else {
                    const catIdx = getImpactCategory(pt.mean_impact);
                    if (catIdx !== climateImpactFilter) opacity = '0.1';
                }
            }

            if (pt) {
                const val = pt.mean_impact;
                const catIdx = getImpactCategory(val);

                // Dimming Logic (Filter by Impact Legend)
                if (climateImpactFilter !== null && catIdx !== climateImpactFilter) {
                    opacity = '0.1';
                }

                if (val < 0.5) color = "#4ade80"; // Green
                else if (val < 2.0) color = "#facc15"; // Yellow
                else if (val < 3.5) color = "#fb923c"; // Orange
                else if (val < 6.0) color = "#f87171"; // Red
                else color = "#c084fc"; // Purple

                if (isDark && val < 0.5) color = "#22c55e"; // Dark adjustment (green)

                // Highlight Current Time
                if (w === curW && h === curH) {
                    stroke = 'stroke="#3b82f6" stroke-width="2" paint-order="stroke"';
                } else if (window.selectedClimateKey === `${w}-${h}`) {
                    stroke = 'stroke="#fff" stroke-width="2" paint-order="stroke"';
                }

                svgInner += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="1"
                        fill="${color}" fill-opacity="${opacity}" ${stroke}
                        style="cursor:pointer; transition: fill-opacity 0.2s;"
                        onclick="window.toggleClimateFilter(${w}, ${h}, event)"
                        onmouseenter="window.showClimateTooltip(event, ${w}, ${h}, ${val}, ${pt.mean_temp}, ${pt.mean_dew}, ${pt.count})"
                        onmousemove="window.moveClimateTooltip(event)"
                        onmouseleave="window.hideClimateTooltip()"
                    />`;
            } else {
                // Empty/Missing placeholder (optional, or just skip)
                svgInner += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="1"
                        fill="var(--card-bg)" fill-opacity="0.3" 
                     />`;
            }
        }
    }

    container.innerHTML = `<svg viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" style="width:100%; height:auto; display:block;">${svgInner}</svg>`;
}

export async function fetchIPLocation(originalError) {
    const btn = document.getElementById('gps-btn');
    const originalText = 'Use My Location'; // Hardcoded fallback for text
    if (btn) btn.innerHTML = 'Trying IP Location...';

    console.log("Attempting IP Fallback...");

    try {
        const res = await fetch('https://ipwho.is/');
        const data = await res.json();

        if (data.success) {
            console.log("IP Location Success:", data);
            window.locManager.setLocation(data.latitude, data.longitude, data.city, data.country);
            if (btn) btn.innerHTML = originalText;
        } else {
            throw new Error(data.message || "IP Location failed");
        }
    } catch (e) {
        console.error("IP Fallback failed", e);
        alert(`GPS Failed (${originalError.message}) and IP Location failed. Please search manually.`);
        if (btn) btn.innerHTML = originalText;
    }
}

export function openLocationModal() {
    console.log("Opening Location Modal...");
    var m = document.getElementById('loc-modal');
    if (m) {
        m.classList.add('open');

        // Render Recents if available and search is empty
        var list = document.getElementById('loc-results');
        var searchIn = document.getElementById('loc-search');

        if (list && searchIn) {
            searchIn.value = ''; // Clear search
            list.innerHTML = ''; // Clear list

            if (window.locManager && window.locManager.recents && window.locManager.recents.length > 0) {
                var header = document.createElement('div');
                header.style.cssText = "font-size:0.75rem; color:var(--text-secondary); margin:10px 0 5px 0; text-transform:uppercase; letter-spacing:0.5px;";
                header.textContent = "Recent Locations";
                list.appendChild(header);

                window.locManager.recents.forEach(function (item) {
                    var div = document.createElement('div');
                    div.className = 'loc-item';
                    var country = item.country || '';
                    div.innerHTML = `<div>${item.name} <span class="loc-sub">${country}</span></div>`;
                    div.onclick = function () { window.locManager.setLocation(item.lat, item.lon, item.name, country); };
                    list.appendChild(div);
                });
            }
        }

        setTimeout(function () {
            var i = document.getElementById('loc-search');
            if (i) {
                i.focus();
                // Attach Search Listener if not already attached (or just overwrite oninput)
                i.oninput = async (e) => {
                    const q = e.target.value;
                    if (q.length < 3) return;

                    const res = await window.locManager.searchCity(q);
                    list.innerHTML = ''; // Clear recents
                    if (res && res.length > 0) {
                        res.forEach(item => {
                            var div = document.createElement('div');
                            div.className = 'loc-item';
                            var state = item.admin1 || '';
                            var country = item.country || '';
                            var subText = [state, country].filter(Boolean).join(', ');
                            div.innerHTML = `<div>${item.name} <span class="loc-sub">${subText}</span></div>`;
                            div.onclick = function () { window.locManager.setLocation(item.latitude, item.longitude, item.name, country); };
                            list.appendChild(div);
                        });
                    }
                };
            }
        }, 100);
    } else {
        console.error("Location Modal not found in DOM");
    }
}

export function closeLocationModal(e) {
    var m = document.getElementById('loc-modal');
    if (!m) return;
    if (e && e.target !== m && e.target.id !== 'close-modal') return;
    m.classList.remove('open');
}
export function calculateBestRunTime(data) {
    const banner = document.getElementById('best-run-banner');
    if (!banner || !data || data.length === 0) return;

    const now = new Date();
    let end;

    // Range Logic
    if (window.selectedBestRunRange === '7d') {
        end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (window.selectedBestRunRange === '14d') {
        end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    } else {
        // Default 24h
        end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    const windowData = data.filter(d => {
        const t = new Date(d.time);
        return t >= now && t <= end && d.temp != null && d.dew != null;
    });

    if (windowData.length === 0) {
        banner.style.display = 'none';
        return;
    }

    // 2. Reference
    const baseSec = 300;

    // 3. Find Min Impact
    let minImpact = 999;
    let bestHour = null;

    if (!window.hapCalc) {
        // console.warn('hapCalc not initialized for best run calculation');
        return;
    }

    windowData.forEach((d) => {
        const adj = window.hapCalc.calculatePaceInHeat(baseSec, d.temp, d.dew);
        const imp = ((adj - baseSec) / baseSec) * 100;
        if (imp < minImpact) {
            minImpact = imp;
            bestHour = d;
        }
    });

    if (!bestHour) return;

    // 4. Update UI
    const dateBest = new Date(bestHour.time);
    const timeStr = dateBest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Smart Date String
    let dayStr;
    if (dateBest.getDate() === now.getDate()) {
        dayStr = 'Today';
    } else if (dateBest.getDate() === new Date(now.getTime() + 86400000).getDate()) {
        dayStr = 'Tomorrow';
    } else {
        dayStr = dateBest.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    const elVal = document.getElementById('best-run-val');
    const elImp = document.getElementById('best-run-impact');

    if (elVal && elImp) {
        elVal.innerHTML = `${dayStr} ${timeStr}`;

        // Use unified color logic
        const color = getImpactColor(minImpact);

        elImp.textContent = `+${minImpact.toFixed(1)}% Impact`;
        elImp.className = `insight-impact`;
        elImp.style.color = color;

        banner.style.display = 'flex';
    }
}

export function setupWindowHelpers() {
    console.log("Window Helpers Setup");

    // Global click listener for deselecting
    document.addEventListener('click', (e) => {
        // Forecast Deselection
        if (window.selectedForeHour) {
            const chart = document.getElementById('forecast-chart-container');
            const legend = document.getElementById('forecast-legend-container');
            const isOutsideChart = !chart || !chart.contains(e.target);
            const isOutsideLegend = !legend || !legend.contains(e.target);
            console.log('Click check Forecast:', { isOutsideChart, isOutsideLegend, target: e.target });

            if (isOutsideChart && isOutsideLegend) {
                console.log("Deselecting Forecast");
                toggleForeSelection(null);
            }
        }

        // Climate Deselection
        if (window.selectedClimateKey) {
            const cmap = document.getElementById('climate-heatmap-container');
            const cleg = document.getElementById('climate-legend-container');
            if ((cmap && !cmap.contains(e.target)) && (cleg && !cleg.contains(e.target))) {
                toggleClimateFilter(null, null);
            }
        }

        // Info Tooltip Dismiss (click outside)
        const tooltip = document.getElementById('forecast-tooltip');
        if (tooltip && tooltip.style.opacity === '1') {
            // Check if click is on an info icon (has showInfoTooltip onclick)
            const isInfoIcon = e.target.closest('[onclick*="showInfoTooltip"]');
            if (!isInfoIcon && !tooltip.contains(e.target)) {
                tooltip.style.opacity = '0';
                tooltip.style.display = 'none';
            }
        }
    });

    // Responsive Chart Resizing
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Re-render charts that need responsive sizing
            if (forecastData && forecastData.length > 0) {
                renderForecastChart('forecast-chart-container-16', 14);
            }
            // Re-render heatmaps if needed
            renderForecastHeatmap('forecast-grid-container-16', '#legend-container-16', 14);
            renderClimateHeatmap();
        }, 150); // Debounce
    });

}

export function renderForecastHeatmap(contId, legSelector, dayLimit) {
    const cont = document.getElementById(contId);
    const legCont = document.querySelector(legSelector);
    if (!cont || !forecastData.length) return;

    // Group by Day
    const days = {};
    forecastData.forEach(d => {
        const dayKey = d.time.substring(0, 10);
        if (!days[dayKey]) days[dayKey] = [];
        days[dayKey].push(d);
    });

    // Settings
    let baseSec = getBasePaceSec();

    // SVG Dimensions
    const cellW = 18;
    const cellH = 18;
    const gap = 2;
    const labelW = 48;
    const headerH = 14;

    const totalW = labelW + (24 * (cellW + gap));
    const totalH = headerH + ((dayLimit || 7) * (cellH + gap));

    let svgInner = '';

    // Hour Labels (Top)
    for (let h = 0; h < 24; h++) {
        const x = labelW + (h * (cellW + gap)) + (cellW / 2);
        const y = headerH - 4;
        svgInner += `<text x="${x}" y="${y}" text-anchor="middle" font-size="8" fill="var(--text-secondary)">${h}</text>`;
    }

    // Local ISO for "current hour" check
    const getLocalIso = () => {
        const now = new Date();
        const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false };
        const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
        const p = {};
        parts.forEach(({ type, value }) => p[type] = value);
        return `${p.year}-${p.month}-${p.day}T${p.hour}`;
    };
    const currentIsoPrefix = getLocalIso();

    // Render Days
    const dayKeys = Object.keys(days).slice(0, dayLimit || 7);
    dayKeys.forEach((dayKey, i) => {
        const dayData = days[dayKey];
        const dObj = new Date(dayKey + 'T12:00:00');
        const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = dayKey.substring(8) + '/' + dayKey.substring(5, 7);

        const yBase = headerH + (i * (cellH + gap));

        // Day Label (Left)
        svgInner += `<text x="${labelW - 6}" y="${yBase + (cellH / 2) + 3}" text-anchor="end" font-size="9" font-weight="600" fill="var(--text-primary)">
            ${dayName} <tspan font-size="7" font-weight="normal" opacity="0.7">${dateStr}</tspan>
        </text>`;

        // Cells
        for (let h = 0; h < 24; h++) {
            const hStr = 'T' + String(h).padStart(2, '0') + ':';
            const d = dayData.find(item => item.time.includes(hStr));

            const x = labelW + (h * (cellW + gap));

            if (d) {
                let pct = 0;
                let color = 'var(--card-bg)';
                let category = 'Ideal';

                if (d.temp != null && d.dew != null && window.hapCalc) {
                    const adjPace = window.hapCalc.calculatePaceInHeat(baseSec, d.temp, d.dew);
                    pct = ((adjPace - baseSec) / baseSec) * 100;
                    color = getImpactColor(pct);
                    category = getImpactCategory(pct);
                } else {
                    pct = 0;
                    color = '#333';
                }

                let opacity = '1';
                if (selectedImpactFilter && category !== selectedImpactFilter) opacity = '0.05';
                if (selectedForeHour && selectedForeHour !== d.time) opacity = '0.2';

                let stroke = '';
                if (d.time.startsWith(currentIsoPrefix)) {
                    stroke = 'stroke="#fff" stroke-width="1.5"';
                }
                if (selectedForeHour === d.time) {
                    stroke = 'stroke="#fff" stroke-width="2" paint-order="stroke"';
                }

                svgInner += `<rect x="${x}" y="${yBase}" width="${cellW}" height="${cellH}" rx="2" 
                    fill="${color}" fill-opacity="${opacity}" ${stroke}
                    style="cursor:pointer; transition: fill-opacity 0.2s;"
                    data-action="select-forecast"
                    data-time="${d.time}"
                    data-day="${dayName} ${dateStr}"
                    data-hour="${h}"
                    data-temp="${d.temp != null ? d.temp.toFixed(1) : '--'}"
                    data-dew="${d.dew != null ? d.dew.toFixed(1) : '--'}"
                    data-pct="${pct.toFixed(2)}"
                    data-color="${color}"
                />`;
            } else {
                svgInner += `<rect x="${x}" y="${yBase}" width="${cellW}" height="${cellH}" rx="2" fill="var(--card-bg)" opacity="0.1" />`;
            }
        }
    });

    cont.innerHTML = `<svg viewBox="0 0 ${totalW} ${totalH}" style="width:100%; height:auto; display:block;">${svgInner}</svg>`;

    // Render Interactive Legend
    if (legCont) {
        const cats = [
            { l: 'Ideal', c: '#4ade80', lt: '&lt;0.5%' },
            { l: 'Good', c: '#facc15', lt: '&lt;2%' },
            { l: 'Fair', c: '#fb923c', lt: '&lt;3.5%' },
            { l: 'Warning', c: '#f87171', lt: '&lt;6%' },
            { l: 'Severe', c: '#c084fc', lt: '&ge;6%' }
        ];

        let lHtml = '';
        cats.forEach(cat => {
            const isActive = selectedImpactFilter === cat.l;
            const border = isActive ? '2px solid #fff' : '1px solid transparent';
            const opacity = (selectedImpactFilter && !isActive) ? '0.4' : '1';

            lHtml += `
                <div class="legend-item" data-action="filter-impact" data-category="${cat.l}" style="cursor:pointer; opacity:${opacity}; transition:all 0.2s;">
                    <div class="legend-color" style="background-color:${cat.c}; border:${border}; box-shadow: ${isActive ? '0 0 8px ' + cat.c : 'none'};"></div>
                    <span>${cat.l} <span style="font-size:0.75em; opacity:0.7">(${cat.lt})</span></span>
                </div>
            `;
        });
        legCont.innerHTML = lHtml;
    }
}

export function update(els, hapCalc) {
    // 1. Read Inputs
    const state = {
        distance: parseFloat(els.distance.value) || 0,
        timeSec: parseTime(els.time.value),
        temp: parseFloat(els.temp.value),
        dew: parseFloat(els.dew.value)
    };

    // Logic Rule: Dew Point cannot be > Temp
    if (!isNaN(state.temp) && !isNaN(state.dew) && state.dew > state.temp) {
        state.dew = state.temp;
        els.dew.value = state.temp; // Update UI immediately
    }

    // 2. Pure Calculation (Engine)
    const res = calculatePacingState(state, hapCalc);

    // 3. Render Results

    // a) Invalid Input Handling
    if (!res || !res.valid) {
        if (els.pred5k) els.pred5k.textContent = "--:--";
        if (els.vdot) els.vdot.textContent = "--";
        const elThreshold = document.getElementById('vdot-threshold');
        if (elThreshold) elThreshold.textContent = "--/km";
        return;
    }

    // b) Valid Output Rendering
    if (document.activeElement !== els.inputPace && els.inputPace) {
        els.inputPace.value = formatTime(res.inputPaceSec);
    }

    if (els.pred5k) els.pred5k.textContent = formatTime(res.pred5kSec);
    if (els.vdot) els.vdot.textContent = res.vdot.toFixed(1);

    const elThreshold = document.getElementById('vdot-threshold');
    if (elThreshold) {
        elThreshold.textContent = `${formatTime(res.paces.threshold)}/km`;
    }

    // Determine Impact Color
    let impactColor = "#fb923c"; // fallback
    if (res.weather.valid) {
        impactColor = getImpactColor(res.weather.impactPct);
    }

    // Helper: Render Pace Row
    const renderRow = (key, elPace, elDist, distDuration) => {
        if (!elPace) return;

        const pace = res.paces[key];

        // Neutral Pace Display
        let html = formatTime(pace) + "/km";
        elPace.style.color = ""; // reset

        // Adjusted Pace Logic
        if (res.weather.valid && res.weather.adjustedPaces[key]) {
            const adjPace = res.weather.adjustedPaces[key];

            // Only show if significant diff
            if (adjPace > pace + 0.5) {
                const adjStr = formatTime(adjPace);
                // Apply Dynamic Impact Color
                html += ` <span style="color:${impactColor}; font-size:0.85em; margin-left:4px;">(${adjStr})</span>`;
            }
        }

        // Dist Display
        let distHtml = "";
        if (elDist && distDuration > 0) {
            const dMeters = Math.round((distDuration / pace) * 1000);
            distHtml = dMeters + " m";

            // Adjusted Dist logic (optional, user didn't explicitly ask for dist color but safe to keep neutral or match)
            // Let's keep dist neutral for now unless requested, or match pattern.
            // Actually user asked: "o pace e distância ajustados, com a mesma cor"
            if (res.weather.valid && res.weather.adjustedPaces[key]) {
                const adjPace = res.weather.adjustedPaces[key];
                if (adjPace > pace + 0.5) {
                    const adjDistMeters = Math.round((distDuration / adjPace) * 1000);
                    distHtml += ` <span style="color:${impactColor}; font-size:0.85em; margin-left:4px;">(${adjDistMeters} m)</span>`;
                }
            }
        }

        elPace.innerHTML = html;
        if (elDist) elDist.innerHTML = distHtml;
    };

    // Render Cards
    renderRow('p10min', els.pace10, els.dist10, 600);
    renderRow('p6min', els.pace6, els.dist6, 360);
    renderRow('p3min', els.pace3, els.dist3, 180);
    renderRow('easy', els.paceEasy, null, 0);

    // Impact Text
    if (res.weather.valid) {
        if (els.weatherImpact) {
            els.weatherImpact.innerHTML = `Heat Impact: <span style="color:${impactColor}">~${res.weather.impactPct.toFixed(1)}% slowdown</span>`;
        }
    } else {
        if (els.weatherImpact) els.weatherImpact.textContent = "";
    }

    // Save State (Side Effect)
    saveToStorage('vdot_calc_state', {
        distance: state.distance,
        time: els.time.value // keep raw string
    });
}

export function copyResults(els) {
    if (!els || !els.time) return; // safety
    const inputTime = els.time.value;
    const inputDist = els.distance.value;
    const currentVDOT = els.vdot.textContent;

    const getTxt = (el) => el && el.innerText ? el.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const results = [
        `NSA Pacing (TT: ${inputDist}m in ${inputTime})`,
        `VDOT: ${currentVDOT}`,
        ``,
        `Sub-T Workouts:`,
        `- 10min (30KP): ${getTxt(els.pace10)}`,
        `- 6min (HMP): ${getTxt(els.pace6)}`,
        `- 3min (15KP): ${getTxt(els.pace3)}`,
        ``,
        `Easy Pace: ${getTxt(els.paceEasy)}`
    ];

    if (els.temp.value) {
        results.splice(2, 0, `Weather: ${els.temp.value}°C (Dew: ${els.dew.value || '-'}°C)`);
    }

    navigator.clipboard.writeText(results.join('\n')).then(() => {
        const btn = document.getElementById('copy-btn');
        if (btn) {
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
            setTimeout(() => {
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
            }, 1500);
        }
    }).catch(err => console.error("Failed to copy", err));
}

export function useGPS() {
    if (!navigator.geolocation) {
        if (window.fetchIPLocation) window.fetchIPLocation({ message: "Geolocation not supported" });
        return;
    }
    const btn = document.getElementById('gps-btn');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = 'Locating... (Please Wait)';

    const options = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
            const city = await reverseGeocode(lat, lon);
            const name = city ? city.name : "My Location";
            const country = city ? city.country : "";
            if (window.locManager) window.locManager.setLocation(lat, lon, name, country);
        } catch (e) {
            console.error("GPS Reverse Geocode Error", e);
            if (window.locManager) window.locManager.setLocation(lat, lon, "My Location", "");
        }
        if (btn) btn.innerHTML = originalText;
    }, (err) => {
        console.warn("Native GPS Error:", err);
        // Fallback to IP location if GPS fails (e.g., kCLErrorLocationUnknown)
        if (window.fetchIPLocation) {
            window.fetchIPLocation(err);
        } else {
            console.error("fetchIPLocation not found for fallback");
            if (btn) btn.innerHTML = originalText;
        }
    }, options);
}


export function renderForecastTable(tableBodyId, dayLimit) {
    const tbody = document.getElementById(tableBodyId || 'forecast-body');
    if (!tbody || !forecastData.length) return;

    const table = tbody.closest('table');
    const thead = table ? table.querySelector('thead tr') : null;

    if (thead) {
        const headers = thead.querySelectorAll('th');
        const colMap = ['time', 'temp', 'dew', 'rain', 'wind', 'impact', 'impact'];

        headers.forEach((th, i) => {
            let text = th.getAttribute('data-title');
            if (!text) {
                text = th.innerText.replace(/[▲▼↑↓]/g, '').trim();
                th.setAttribute('data-title', text);
            }
            th.innerText = text;
            th.style.color = '';

            const colName = colMap[i];
            let active = (forecastSortCol === colName);
            if (colName === 'rain' && forecastSortCol === 'prob') active = true;

            if (active) {
                th.style.color = 'var(--accent-color)';
                th.innerText += (forecastSortDir === 'asc' ? ' ↑' : ' ↓');
            }
        });
    }

    let baseSec = getBasePaceSec();
    let html = '';

    // Filter
    let viewData = [];
    let displayLimitDate = null;
    if (dayLimit) {
        const start = new Date(forecastData[0].time);
        displayLimitDate = new Date(start);
        displayLimitDate.setDate(start.getDate() + dayLimit);
    }

    if (selectedForeHour) {
        viewData = forecastData.filter(d => d.time === selectedForeHour);
    } else {
        const now = new Date();
        viewData = forecastData.filter(item => {
            const t = new Date(item.time);
            return t > now && (!displayLimitDate || t < displayLimitDate);
        });
    }

    if (selectedImpactFilter) {
        viewData = viewData.filter(d => {
            const adj = window.hapCalc.calculatePaceInHeat(baseSec, d.temp, d.dew);
            const p = ((adj - baseSec) / baseSec) * 100;
            return getImpactCategory(p) === selectedImpactFilter;
        });
    }

    // Sort
    viewData.sort((a, b) => {
        let valA, valB;
        if (forecastSortCol === 'time') {
            return (new Date(a.time) - new Date(b.time)) * (forecastSortDir === 'asc' ? 1 : -1);
        }
        if (forecastSortCol === 'temp') { valA = a.temp; valB = b.temp; }
        else if (forecastSortCol === 'dew') { valA = a.dew; valB = b.dew; }
        else if (forecastSortCol === 'rain') { valA = a.rain || 0; valB = b.rain || 0; }
        else if (forecastSortCol === 'prob') { valA = a.prob || 0; valB = b.prob || 0; }
        else if (forecastSortCol === 'wind') { valA = a.wind || 0; valB = b.wind || 0; }
        else {
            const adjA = window.hapCalc.calculatePaceInHeat(baseSec, a.temp, a.dew);
            const pctA = ((adjA - baseSec) / baseSec);
            const adjB = window.hapCalc.calculatePaceInHeat(baseSec, b.temp, b.dew);
            const pctB = ((adjB - baseSec) / baseSec);
            valA = pctA; valB = pctB;
        }

        valA = Number(valA);
        valB = Number(valB);
        if (isNaN(valA)) valA = -Infinity;
        if (isNaN(valB)) valB = -Infinity;

        if (valA < valB) return forecastSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return forecastSortDir === 'asc' ? 1 : -1;
        return new Date(a.time) - new Date(b.time);
    });

    tbody.innerHTML = viewData.map(h => {
        const date = new Date(h.time);
        const now = new Date();
        const isToday = date.getDate() === now.getDate();
        const dayName = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        let pct = 0;
        let impactColor = '#333';
        let adjPace = baseSec;

        if (h.temp != null && h.dew != null && window.hapCalc) {
            adjPace = window.hapCalc.calculatePaceInHeat(baseSec, h.temp, h.dew);
            pct = ((adjPace - baseSec) / baseSec) * 100;
            impactColor = getImpactColor(pct);
        }

        const rain = h.rain != null ? h.rain : 0;
        const prob = h.prob != null ? h.prob : 0;
        const wind = h.wind != null ? h.wind : 0;
        const dir = h.dir != null ? h.dir : 0;
        const arrowStyle = `display:inline-block; transform:rotate(${dir}deg); font-size:0.8em; margin-left:2px;`;

        const tempColor = window.getCondColor ? window.getCondColor('air', h.temp) : 'inherit';
        const probColor = window.getCondColor ? window.getCondColor('prob', prob) : 'inherit';
        const windColor = window.getCondColor ? window.getCondColor('wind', wind) : 'inherit';
        const rainColor = rain > 0 ? '#60a5fa' : 'inherit';
        const dewColor = window.getDewColor ? window.getDewColor(h.dew) : 'inherit';

        return `
        <tr style="${window.selectedForeHour && h.time === window.selectedForeHour ? 'background:var(--card-bg); font-weight:bold;' : ''}">
            <td style="padding:10px; color:var(--text-secondary); white-space:nowrap;">
                <div style="font-size:0.75em;">${dayName}</div>
                <div style="font-size:1em; color:var(--text-primary); font-weight:500;">${timeStr}</div>
            </td>
            <td style="text-align:center; color:${tempColor}">${h.temp != null ? h.temp.toFixed(1) : '--'}°</td>
            <td style="text-align:center; color:${dewColor}">${h.dew != null ? h.dew.toFixed(1) : '--'}°</td>
            <td style="text-align:center;">
                <div style="color:${rainColor};">${rain > 0 ? rain.toFixed(1) + 'mm' : '-'}</div>
                <div style="font-size:0.75em; color:${prob > 0 ? probColor : 'var(--text-secondary)'}; opacity:0.8;">${prob > 0 ? '(' + prob + '%)' : ''}</div>
            </td>
            <td style="text-align:center; color:${windColor}">${wind.toFixed(0)} <span style="font-size:0.7em;color:var(--text-secondary)">km/h</span> <span style="${arrowStyle}">↓</span></td>
            <td style="text-align:center;">
                <span class="impact-badge" style="background:${impactColor}; color:${pct > 2.0 ? '#000' : '#000'}; font-weight:600;">
                    ${pct.toFixed(1)}%
                </span>
            </td>
            <td style="text-align:right; font-family:monospace; font-size:1.1em; color:var(--accent-color);">
                ${formatTime(adjPace)}
            </td>
        </tr>`;
    }).join('');
}

export function renderVDOTDetails() {
    // Requires els from window or argument. Assuming window.els
    const els = window.els;
    if (!els) return;

    const cont = document.getElementById('vdot-details');
    if (!cont) return;
    const dInput = parseFloat(els.distance.value);
    const tInput = parseTime(els.time.value);

    if (!dInput || !tInput || dInput <= 0) {
        cont.innerHTML = '<div style="color:var(--text-secondary); font-size:0.8rem;">Enter a valid Time Trial to see details.</div>';
        return;
    }

    const dists = [
        { l: '50 km', d: 50000 },
        { l: 'Marathon', d: 42195 },
        { l: '30 km', d: 30000 },
        { l: 'Half Marathon', d: 21097 },
        { l: '15 km', d: 15000 },
        { l: '12 km', d: 12000 },
        { l: '10 km', d: 10000 },
        { l: '8 km', d: 8000 },
        { l: '6 km', d: 6000 },
        { l: '5 km', d: 5000 },
        { l: '3 Miles', d: 4828 },
        { l: '2 Miles', d: 3218 },
        { l: '3200m', d: 3200 },
        { l: '3000m', d: 3000 },
        { l: '1 Mile', d: 1609 },
        { l: '1600m', d: 1600 },
        { l: '1500m', d: 1500 },
        { l: '1000m', d: 1000 },
        { l: '800m', d: 800 }
    ];

    let html = `
        <table class="vdot-details-table">
            <thead>
                <tr>
                    <th>Distance</th>
                    <th style="text-align:right;">Time</th>
                    <th style="text-align:right;">Pace</th>
                </tr>
            </thead>
            <tbody>
    `;

    const currentVDOT = VDOT_MATH.calculateVDOT(dInput, tInput);

    dists.forEach((item, i) => {
        const t2 = VDOT_MATH.solveTime(currentVDOT, item.d);
        const pace = t2 / (item.d / 1000);

        let tStr = formatTime(t2);
        let tPretty = tStr;
        if (t2 >= 3600) {
            const h = Math.floor(t2 / 3600);
            const m = Math.floor((t2 % 3600) / 60);
            const s = Math.floor(t2 % 60);
            tPretty = `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        }

        html += `
            <tr>
                <td>${item.l}</td>
                <td style="text-align:right;"><span class="time-val">${tPretty}</span></td>
                <td style="text-align:right;"><span class="pace-val">${formatTime(pace)}/km</span></td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    cont.innerHTML = html;
}

// Redefine at end to ensure dependencies
export function renderAllForecasts() {
    calculateBestRunTime(forecastData);

    // Render 16-Day Tab (Now 14 Days)
    renderForecastHeatmap('forecast-grid-container-16', '#legend-container-16', 14);
    renderForecastTable('forecast-body-16', 14);
    renderForecastChart('forecast-chart-container-16', 14);
}

const loadTimers = {};

export function setLoading(type, visible) {
    const id = `loading-${type}`;
    const el = document.getElementById(id);
    if (!el) return;

    if (visible) {
        // Debounce: Only show if loading takes > 300ms
        if (loadTimers[type]) clearTimeout(loadTimers[type]);
        loadTimers[type] = setTimeout(() => {
            el.classList.add('visible');
        }, 300);
    } else {
        // Cancel pending show
        if (loadTimers[type]) {
            clearTimeout(loadTimers[type]);
            loadTimers[type] = null;
        }
        // Hide immediately
        el.classList.remove('visible');
    }
}

