import { UIState } from './state.js';
import { infoIcon, getImpactColor, getDewColor, getCondColor, getImpactCategory, getBasePaceSec, getDateFromWeek, getWeatherIcon } from './utils.js';
import { VDOT_MATH, parseTime, formatTime } from '../core.js';
import { calculateAgeGrade } from '../engine.js';

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

    let html = '';

    // Age Grade Section
    const age = window.runnerAge;
    const gender = window.runnerGender;
    if (age && gender && calculateAgeGrade) {
        const agRes = calculateAgeGrade(dInput, tInput, age, gender);
        if (agRes) {
            const tooltipTable = '<table style="width:100%; text-align:left; font-size:0.9em; border-collapse:collapse; margin-top:4px;"><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><th style="padding:2px 0;">Level</th><th style="text-align:right; padding:2px 0;">Class</th></tr><tr><td style="padding:2px 0;">100%</td><td style="text-align:right; color:#e2e8f0;">World Record</td></tr><tr><td style="padding:2px 0;">90%+</td><td style="text-align:right; color:#e2e8f0;">World Class</td></tr><tr><td style="padding:2px 0;">80%+</td><td style="text-align:right; color:#e2e8f0;">National Class</td></tr><tr><td style="padding:2px 0;">70%+</td><td style="text-align:right; color:#e2e8f0;">Regional Class</td></tr><tr><td style="padding:2px 0;">60%+</td><td style="text-align:right; color:#e2e8f0;">Local Class</td></tr></table>';

            const infoHtml = infoIcon('Age Grade Standards', tooltipTable);

            html += `
             <div style="margin-bottom:16px; padding:12px; background:var(--bg-secondary); border-radius:12px; text-align:center; border:1px solid var(--border-color);">
                <div style="font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">
                    Age Grade (${age}${gender}) ${infoHtml}
                </div>
                <div style="font-size:1.5rem; font-weight:800; color:var(--accent-color); line-height:1.2;">${agRes.score.toFixed(1)}%</div>
                <div style="font-size:0.85rem; color:var(--text-primary); font-weight:500; margin-top:2px;">${agRes.class}</div>
             </div>
             `;
        }
    }

    html += `
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

export function renderForecastTable(tableBodyId, dayLimit, isAppend = false) {
    const tbody = document.getElementById(tableBodyId || 'forecast-body');
    if (!tbody || !UIState.forecastData.length) return;

    // Reset limit if not appending (new filter/sort/initial load)
    if (!isAppend) {
        UIState.forecastRenderLimit = 50;
    } else {
        UIState.forecastRenderLimit += UIState.SCROLL_BATCH_SIZE;
    }

    const table = tbody.closest('table');
    const thead = table ? table.querySelector('thead tr') : null;

    if (thead && !isAppend) { // Update header only on fresh render
        const headers = thead.querySelectorAll('th');
        const colMap = ['time', 'temp', 'dew', 'rain', 'wind', 'impact'];

        headers.forEach((th, i) => {
            const colName = colMap[i];
            let text = th.getAttribute('data-title');
            if (!text) {
                text = th.innerText.replace(/[▲▼↑↓]/g, '').trim();
                // FIX: Compact Rain Header
                if (colName === 'rain') text = 'Rain';
                // FIX: Merge Impact/Pace Header
                if (colName === 'impact') text = 'Pace';
                th.setAttribute('data-title', text);
            }
            th.innerText = text;
            th.style.color = '';
            let active = (UIState.forecastSortCol === colName);
            if (colName === 'rain' && UIState.forecastSortCol === 'prob') active = true;

            if (active) {
                th.style.color = 'var(--accent-color)';
                th.innerText += (UIState.forecastSortDir === 'asc' ? ' ↑' : ' ↓');
            }
        });
    }

    let baseSec = getBasePaceSec();

    // Filter
    let viewData = [];
    let displayLimitDate = null;
    if (dayLimit) {
        const start = new Date(UIState.forecastData[0].time);
        displayLimitDate = new Date(start);
        displayLimitDate.setDate(start.getDate() + dayLimit);
    }

    if (UIState.selectedForeHour) {
        viewData = UIState.forecastData.filter(d => d.time === UIState.selectedForeHour);
    } else {
        const now = new Date();
        viewData = UIState.forecastData.filter(item => {
            const t = new Date(item.time);
            return t > now && (!displayLimitDate || t < displayLimitDate);
        });
    }

    if (UIState.selectedImpactFilter) {
        viewData = viewData.filter(d => {
            const adj = window.hapCalc.calculatePaceInHeat(baseSec, d.temp, d.dew);
            const p = ((adj - baseSec) / baseSec) * 100;
            return getImpactCategory(p) === UIState.selectedImpactFilter;
        });
    }

    // Sort
    viewData.sort((a, b) => {
        let valA, valB;
        if (UIState.forecastSortCol === 'time') {
            return (new Date(a.time) - new Date(b.time)) * (UIState.forecastSortDir === 'asc' ? 1 : -1);
        }
        if (UIState.forecastSortCol === 'temp') { valA = a.temp; valB = b.temp; }
        else if (UIState.forecastSortCol === 'dew') { valA = a.dew; valB = b.dew; }
        else if (UIState.forecastSortCol === 'rain') { valA = a.rain || 0; valB = b.rain || 0; }
        else if (UIState.forecastSortCol === 'prob') { valA = a.prob || 0; valB = b.prob || 0; }
        else if (UIState.forecastSortCol === 'wind') { valA = a.wind || 0; valB = b.wind || 0; }
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

        if (valA < valB) return UIState.forecastSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return UIState.forecastSortDir === 'asc' ? 1 : -1;
        return new Date(a.time) - new Date(b.time);
    });

    // Pagination Slice
    const startIdx = isAppend ? UIState.forecastRenderLimit - UIState.SCROLL_BATCH_SIZE : 0;
    const endIdx = UIState.forecastRenderLimit;
    const itemsToRender = viewData.slice(startIdx, endIdx);

    if (!itemsToRender.length && isAppend) return; // No more data to append

    const html = itemsToRender.map(h => {
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
            <td style="padding:6px; color:var(--text-secondary); white-space:nowrap;">
                <div style="font-size:0.75em; display:flex; align-items:center; gap:1px;">
                    ${getWeatherIcon(h.weathercode)} 
                    ${dayName}
                </div>
                <div style="font-size:1em; color:var(--text-primary); font-weight:500;">
                    ${timeStr}
                </div>
            </td>
            <td style="text-align:center; color:${tempColor};">${h.temp != null ? h.temp.toFixed(1) : '-'}°</td>
            <td style="text-align:center; color:${dewColor};">${h.dew != null ? h.dew.toFixed(1) : '-'}°</td>
            <td style="text-align:center; color:${rainColor};">
                <div style="font-weight:500;">${rain > 0 ? rain.toFixed(1) + 'mm' : '-'}</div>
                <div style="font-size:0.75em; color:${probColor};">${prob}%</div>
            </td>
            <td style="text-align:center; color:${windColor};">
                <div>${wind.toFixed(1)} <span style="font-size:0.7em; color:var(--text-secondary)">km/h</span></div>
                <div style="font-size:0.7em; color:var(--text-secondary); display:flex; align-items:center; justify-content:center;">
                   <span style="${arrowStyle}">↓</span>
                </div>
            </td>
            <td style="text-align:center;">
                 <div style="font-family:'Courier New', monospace; font-size:1em; font-weight:700; color:var(--accent-color); margin-bottom:2px;">
                    ${formatTime(adjPace)}
                </div>
                <span class="impact-badge" style="background:${impactColor}; color:#000; font-weight:600; font-size:0.75em;">
                    ${pct.toFixed(2)}%
                </span>
            </td>
        </tr>`;
    }).join('');

    if (isAppend) {
        tbody.insertAdjacentHTML('beforeend', html);
    } else {
        tbody.innerHTML = html;
        // Reset scroll position on full re-render
        if (tbody.parentElement && tbody.parentElement.parentElement) {
            tbody.parentElement.parentElement.scrollTop = 0;
        }
    }
}

export function renderClimateTable(isAppend = false) {
    const tb = document.getElementById('climateTableBody');
    if (!tb) return;

    // Reset pagination limit if not appending
    if (!isAppend) {
        UIState.climateRenderLimit = 50;
    } else {
        UIState.climateRenderLimit += UIState.SCROLL_BATCH_SIZE;
    }

    let data = (UIState.climateData || window.climateData || []).slice();

    // 1. Filter by Clicked Heatmap Cell (Week-Hour)
    if (UIState.selectedClimateKey) {
        const [selW, selH] = UIState.selectedClimateKey.split('-').map(Number);
        data = data.filter(d => d.week === selW && d.hour === selH);

        // Show Filter Label
        const lbl = document.getElementById('climate-filter-label');
        if (lbl) {
            lbl.classList.remove('hidden');
            lbl.innerText = `Week ${selW}, ${selH}:00`;
        }
        const clr = document.getElementById('climate-clear-filter');
        if (clr) clr.classList.remove('hidden');
    } else {
        const lbl = document.getElementById('climate-filter-label');
        if (lbl) lbl.classList.add('hidden');
        const clr = document.getElementById('climate-clear-filter');
        if (clr) clr.classList.add('hidden');
    }

    // 2. Filter by Impact Category (Legend Click)
    if (UIState.climateImpactFilter !== null) {
        data = data.filter(d => {
            const catIdx = getImpactCategory(d.mean_impact);
            return catIdx === UIState.climateImpactFilter;
        });
    }

    // 3. Sort
    const dir = UIState.climateSortDir === 'asc' ? 1 : -1;

    // Reset Icons
    document.querySelectorAll('[id^="sort-icon-climate-"]').forEach(el => el.innerText = '');
    const icon = dir === 1 ? '▲' : '▼';
    const iconEl = document.getElementById('sort-icon-climate-' + UIState.climateSortCol);
    if (iconEl) iconEl.innerText = ' ' + icon;

    data.sort((a, b) => {
        let valA, valB;
        if (UIState.climateSortCol === 'date') { valA = a.week; valB = b.week; } // Week proxy
        else if (UIState.climateSortCol === 'hour') { valA = a.hour; valB = b.hour; }
        else if (UIState.climateSortCol === 'temp') { valA = a.mean_temp; valB = b.mean_temp; }
        else if (UIState.climateSortCol === 'dew') { valA = a.mean_dew; valB = b.mean_dew; }
        else if (UIState.climateSortCol === 'wind') { valA = a.mean_wind; valB = b.mean_wind; }
        else if (UIState.climateSortCol === 'precip') { valA = a.mean_precip; valB = b.mean_precip; }
        else if (UIState.climateSortCol === 'impact') { valA = a.mean_impact; valB = b.mean_impact; }

        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    });

    // 4. Pagination Slice
    const startIdx = isAppend ? UIState.climateRenderLimit - UIState.SCROLL_BATCH_SIZE : 0;
    const endIdx = UIState.climateRenderLimit;
    const itemsToRender = data.slice(startIdx, endIdx);

    if (isAppend && itemsToRender.length === 0) return; // Nothing left to append

    const html = itemsToRender.map(d => {
        const dateStr = getDateFromWeek(d.week);
        // Match Forecast Table Logic
        const timeStr = `${String(d.hour).padStart(2, '0')}:00`;

        let impactColor = "#4ade80";
        if (d.mean_impact >= 6.0) impactColor = "#c084fc";
        else if (d.mean_impact >= 3.5) impactColor = "#f87171";
        else if (d.mean_impact >= 2.0) impactColor = "#fb923c";
        else if (d.mean_impact >= 0.5) impactColor = "#facc15";

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

    if (isAppend) {
        tb.insertAdjacentHTML('beforeend', html);
    } else {
        tb.innerHTML = html;
        if (tb.parentElement && tb.parentElement.parentElement) {
            tb.parentElement.parentElement.scrollTop = 0;
        }
    }
}
