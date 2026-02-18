import { UIState } from './state.js';
import { getImpactColor, getActiveWeatherTimeZone } from './utils.js';
import { loadFromStorage, saveToStorage } from '../storage.js';
import { AppState } from '../appState.js';
import { formatDisplayPrecip, formatDisplayTemperature, getUnitSystem, precipitationUnit, temperatureUnit } from '../units.js';
import {
    addDaysToIsoMinute,
    getDateForISOWeek,
    getNowIsoMinute,
    getReferenceYear,
    getTimeZoneParts,
    parseIsoMinuteToUtcDate
} from '../time.js';

export function renderOverview() {
    // Placeholder if needed
}

export function calculateBestRunTime(data) {
    const banner = document.getElementById('best-run-banner');
    if (!banner || !data || data.length === 0) return;

    const timeZone = getActiveWeatherTimeZone();
    let nowIso = getNowIsoMinute();
    try {
        nowIso = getNowIsoMinute(timeZone);
    } catch (e) {
        nowIso = getNowIsoMinute();
    }
    let endIso = addDaysToIsoMinute(nowIso, 1) || nowIso;

    // Range Logic
    if (UIState.selectedBestRunRange === '7d') {
        endIso = addDaysToIsoMinute(nowIso, 7) || endIso;
    } else if (UIState.selectedBestRunRange === '14d') {
        endIso = addDaysToIsoMinute(nowIso, 14) || endIso;
    }

    const windowData = data.filter(d => {
        if (!d || typeof d.time !== 'string') return false;
        return d.time >= nowIso && d.time <= endIso && d.temp != null && d.dew != null;
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

    if (!AppState.hapCalc) {
        // console.warn('hapCalc not initialized for best run calculation');
        return;
    }

    windowData.forEach((d) => {
        const adj = AppState.hapCalc.calculatePaceInHeat(baseSec, d.temp, d.dew);
        const imp = ((adj - baseSec) / baseSec) * 100;
        if (imp < minImpact) {
            minImpact = imp;
            bestHour = d;
        }
    });

    if (!bestHour) return;

    // 4. Update UI
    const bestDateIso = bestHour.time.slice(0, 10);
    const timeStr = bestHour.time.slice(11, 16);
    const todayIso = nowIso.slice(0, 10);
    const tomorrowIso = addDaysToIsoMinute(`${todayIso}T00:00`, 1).slice(0, 10);

    // Smart Date String
    let dayStr;
    if (bestDateIso === todayIso) {
        dayStr = 'Today';
    } else if (bestDateIso === tomorrowIso) {
        dayStr = 'Tomorrow';
    } else {
        const dayDate = parseIsoMinuteToUtcDate(`${bestDateIso}T00:00`);
        dayStr = dayDate
            ? dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
            : bestDateIso;
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

    return bestHour.time; // Return for auto-selection
}

// --- Monthly Averages ---
export function renderMonthlyAverages(data) {
    const container = document.getElementById('monthly-averages-content');
    if (!container) return;
    const system = getUnitSystem();
    const tempUnitLabel = temperatureUnit(system);
    const precipUnitLabel = precipitationUnit(system);

    // Use passed data or global
    const rawData = data || UIState.climateData;
    if (!rawData || !Array.isArray(rawData)) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">No data available</div>';
        return;
    }

    const timeZone = getActiveWeatherTimeZone();
    let refYear = getReferenceYear();
    let currentMIdx = new Date().getMonth();
    try {
        refYear = getReferenceYear(timeZone);
        currentMIdx = getTimeZoneParts(timeZone).month - 1;
    } catch (e) {
        refYear = getReferenceYear();
        currentMIdx = new Date().getMonth();
    }

    const months = Array.from({ length: 12 }, (_, i) => ({
        index: i,
        name: new Date(Date.UTC(refYear, i, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
        weeks: [],
        stats: { min: Infinity, max: -Infinity, rain: 0 }
    }));

    // Helper: Group rawData by Week first (1-53)
    const weeks = {};
    rawData.forEach(d => {
        if (!weeks[d.week]) weeks[d.week] = { temps: [], rains: [] };
        if (d.mean_temp != null) weeks[d.week].temps.push(d.mean_temp);
        if (d.mean_precip != null) weeks[d.week].rains.push(d.mean_precip);
    });

    // Assign Weeks to Months and Aggregate
    Object.keys(weeks).forEach(w => {
        const wk = weeks[w];
        const weekNum = parseInt(w);
        const d = getDateForISOWeek(weekNum, refYear);
        const mIdx = d.getUTCMonth();

        const wMin = Math.min(...wk.temps);
        const wMax = Math.max(...wk.temps);
        const dailyRain = wk.rains.reduce((a, b) => a + b, 0);

        months[mIdx].weeks.push({
            min: wMin,
            max: wMax,
            dailyRain: dailyRain
        });
    });

    // Final Monthly Stats
    let tempGlobalMin = Infinity;
    let tempGlobalMax = -Infinity;
    let rainGlobalMax = 0;

    months.forEach(m => {
        if (m.weeks.length === 0) return;

        // Temperature
        const sumMin = m.weeks.reduce((a, b) => a + b.min, 0);
        const sumMax = m.weeks.reduce((a, b) => a + b.max, 0);
        m.stats.min = sumMin / m.weeks.length;
        m.stats.max = sumMax / m.weeks.length;

        // Rain
        const avgDailyRain = m.weeks.reduce((a, b) => a + b.dailyRain, 0) / m.weeks.length;
        const daysInMonth = new Date(Date.UTC(refYear, m.index + 1, 0)).getUTCDate();
        m.stats.rain = avgDailyRain * daysInMonth;

        // Track globals
        if (m.stats.min < tempGlobalMin) tempGlobalMin = m.stats.min;
        if (m.stats.max > tempGlobalMax) tempGlobalMax = m.stats.max;
        if (m.stats.rain > rainGlobalMax) rainGlobalMax = m.stats.rain;
    });

    // Add padding to temp range
    tempGlobalMin -= 2;
    tempGlobalMax += 2;
    const tempRange = tempGlobalMax - tempGlobalMin || 1;

    // Render with side-by-side layout
    let html = `
    <div style="display:flex; align-items:center; margin-bottom:12px; padding:0 8px; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-secondary); font-weight:600;">
        <div style="width:35px;"></div>
        <div class="monthly-temp-header" style="flex:1; margin-right:20px; text-align:center;">Temperature</div>
        <div class="monthly-rain-header" style="flex:0 0 120px; text-align:center;">Rain</div>
    </div>
    `;
    months.forEach(m => {
        const isCurrent = (m.index === currentMIdx);
        const rowBg = isCurrent ? 'background:rgba(255,255,255,0.05); border-radius:6px;' : '';

        // Temperature bar
        let tempLeft = 0, tempWidth = 0, tempLabelL = '', tempLabelR = '', tempBarStyle = '';
        if (m.weeks.length > 0) {
            tempLeft = ((m.stats.min - tempGlobalMin) / tempRange) * 100;
            tempWidth = ((m.stats.max - m.stats.min) / tempRange) * 100;
            tempLabelL = `${formatDisplayTemperature(m.stats.min, 0, system)}${tempUnitLabel}`;
            tempLabelR = `${formatDisplayTemperature(m.stats.max, 0, system)}${tempUnitLabel}`;

            // More granular scale for better visual representation
            const getTempColor = (temp) => {
                if (temp < 10) return '#60a5fa';   // Blue - Very Cold
                if (temp < 15) return '#67e8f9';   // Cyan - Cold but OK
                if (temp < 20) return '#4ade80';   // Green - Perfect for running
                if (temp < 25) return '#a3e635';   // Yellow-Green - Warm
                if (temp < 28) return '#fbbf24';   // Yellow - Getting Hot
                if (temp <= 32) return '#fb923c';  // Orange - Hot
                if (temp <= 35) return '#f87171';  // Red - Very Hot
                return '#c084fc';                  // Purple - Extreme
            };

            const colorMin = getTempColor(m.stats.min);
            const colorMax = getTempColor(m.stats.max);
            const grad = `linear-gradient(90deg, ${colorMin}, ${colorMax})`;
            tempBarStyle = `background:${grad}; opacity:1; height:6px; border-radius:3px; position:absolute; left:${tempLeft}%; width:${tempWidth}%; top:50%; transform:translateY(-50%);`;
        }

        // Rain bar
        let rainWidth = 0, rainLabel = '';
        if (m.weeks.length > 0) {
            rainWidth = (m.stats.rain / rainGlobalMax) * 100;
            rainLabel = `${formatDisplayPrecip(m.stats.rain, 0, 1, system)}${precipUnitLabel}`;
        }

        html += `
        <div class="monthly-row" style="display:flex; align-items:center; margin-bottom:8px; padding:6px 8px; font-size:0.85rem; ${rowBg};">
            <div style="width:35px; color:var(--text-secondary); font-weight:500; text-transform:capitalize;">${m.name}</div>
            
            <!-- Temperature Section -->
            <div class="monthly-temp-section" style="flex:1; display:flex; align-items:center; margin-right:20px;">
                <div class="monthly-label" style="width:30px; text-align:right; color:var(--text-primary); font-weight:600; margin-right:8px; font-variant-numeric:tabular-nums; font-size:0.8rem;">
                    ${tempLabelL}
                </div>
                <div style="flex:1; position:relative; height:20px;">
                    <div style="background:rgba(255,255,255,0.08); height:4px; border-radius:2px; width:100%; position:absolute; top:50%; transform:translateY(-50%);"></div>
                    <div style="${tempBarStyle}"></div>
                </div>
                <div class="monthly-label" style="width:30px; text-align:left; color:var(--text-primary); font-weight:600; margin-left:8px; font-variant-numeric:tabular-nums; font-size:0.8rem;">
                    ${tempLabelR}
                </div>
            </div>
            
            <!-- Rain Section -->
            <div class="monthly-rain-section" style="flex:0 0 120px; display:flex; align-items:center;">
                <div style="flex:1; position:relative; height:20px; margin-right:8px;">
                    <div style="background:rgba(255,255,255,0.08); height:4px; border-radius:2px; width:100%; position:absolute; top:50%; transform:translateY(-50%);"></div>
                    <div class="monthly-bar-animated" style="background:#60a5fa; height:6px; border-radius:3px; position:absolute; left:0; width:${rainWidth}%; top:50%; transform:translateY(-50%);"></div>
                </div>
                <div class="monthly-label" style="width:40px; text-align:right; color:var(--text-primary); font-weight:600; font-variant-numeric:tabular-nums; font-size:0.8rem;">
                    ${rainLabel}
                </div>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;


    // Restore collapsed state if it was saved
    setTimeout(() => {
        const savedState = loadFromStorage('monthly_averages_collapsed');
        if (savedState === true) {
            const wrapper = document.getElementById('monthly-averages-wrapper');
            const icon = document.getElementById('monthly-toggle-icon');
            if (wrapper) wrapper.style.display = 'none';
            if (icon) icon.style.transform = 'rotate(-90deg)';
        }
    }, 50);
}

// Remove global type since we don't use toggles anymore
// selectedMonthlyType is no longer needed

export function toggleMonthlyAverages() {
    const wrap = document.getElementById('monthly-averages-wrapper');
    const icon = document.getElementById('monthly-toggle-icon');
    if (!wrap) return;

    if (wrap.style.display === 'none' || wrap.offsetHeight === 0) {
        wrap.style.display = 'block';
        wrap.style.height = 'auto';
        if (icon) icon.style.transform = 'rotate(0deg)';
        // Save expanded state
        saveToStorage('monthly_averages_collapsed', false);
    } else {
        wrap.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(-90deg)';
        // Save collapsed state
        saveToStorage('monthly_averages_collapsed', true);
    }
}
