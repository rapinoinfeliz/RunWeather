import { UIState } from './state.js';
import { infoIcon, getImpactColor, getDewColor, getCondColor, getImpactCategory, getBasePaceSec, getDateFromWeek, getWeatherIcon } from './utils.js';
import { HAPCalculator, VDOT_MATH, parseTime, formatTime, getEasyPace, getISOWeek } from '../core.js';
import { calculatePacingState, calculateWBGT } from '../engine.js';
import { loadFromStorage, saveToStorage } from '../storage.js';
// Chart.js is loaded globally via script tag 
// No, the code likely uses global Chart or dynamic import. 
// Let's check if ui.js imports Chart? No, it probably assumes window.Chart or logic is different.
// Checking ui.js imports (lines 1-10) in previous steps showed no Chart import.
// So probably uses window.Chart.


export function renderAllForecasts() {
    calculateBestRunTime(UIState.forecastData);

    // Render 16-Day Tab (Now 14 Days)
    renderForecastHeatmap('forecast-grid-container-16', '#legend-container-16', 14);
    renderForecastTable('forecast-body-16', 14);
    renderForecastChart('forecast-chart-container-16', 14);
    renderRainChart('forecast-rain-chart-container-16', 14);
    renderWindChart('forecast-wind-chart-container-16', 14);
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

export function renderForecastHeatmap(contId, legSelector, dayLimit) {
    const cont = document.getElementById(contId);
    const legCont = document.querySelector(legSelector);
    if (!cont || !UIState.forecastData.length) return;

    // Group by Day
    const days = {};
    UIState.forecastData.forEach(d => {
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
                if (UIState.selectedImpactFilter && category !== UIState.selectedImpactFilter) opacity = '0.05';
                if (UIState.selectedForeHour && UIState.selectedForeHour !== d.time) opacity = '0.2';

                let stroke = '';
                if (d.time.startsWith(currentIsoPrefix)) {
                    stroke = 'stroke="#fff" stroke-width="1.5"';
                }
                if (UIState.selectedForeHour === d.time) {
                    stroke = 'stroke="#fff" stroke-width="2" paint-order="stroke"';
                }

                // Night Shading Logic (Forecast - Fractional with Dawn/Dusk)
                // User defined Dawn = Sunrise - 25min, Dusk = Sunset + 25min
                let nightRects = [];
                if (UIState.dailyForecast) {
                    const daily = UIState.dailyForecast;
                    let dIdx = -1;
                    if (daily.time) dIdx = daily.time.findIndex(t => t === dayKey);

                    if (dIdx !== -1) {
                        try {
                            const getVal = (str) => {
                                if (!str) return null;
                                const parts = str.split('T')[1].split(':');
                                return parseInt(parts[0], 10) + (parseInt(parts[1], 10) / 60);
                            };
                            const sr = getVal(daily.sunrise[dIdx]);
                            const ss = getVal(daily.sunset[dIdx]);

                            if (sr !== null && ss !== null) {
                                // Apply Offsets
                                const dawn = sr - (25 / 60);
                                const dusk = ss + (25 / 60);

                                // Morning Night: [0, dawn]
                                // Cell is [h, h+1]. Overlap with [0, dawn]
                                const mOverlap = Math.max(0, Math.min(h + 1, dawn) - h);
                                if (mOverlap > 0) nightRects.push({ xOffset: 0, wFrac: mOverlap });

                                // Evening Night: [dusk, 24]
                                // Overlap with [dusk, 24]
                                const eStart = Math.max(h, dusk);
                                const eEnd = Math.min(h + 1, 24);
                                if (eStart < eEnd) nightRects.push({ xOffset: eStart - h, wFrac: eEnd - eStart });
                            }
                        } catch (e) { /* ignore */ }
                    }
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

                // Overlay for Night (Fractional)
                nightRects.forEach(rect => {
                    // Ensure rx is masked or small. 
                    svgInner += `<rect x="${x + (rect.xOffset * cellW)}" y="${yBase}" width="${rect.wFrac * cellW}" height="${cellH}" rx="2" 
                        fill="#000" fill-opacity="${opacity === '1' ? '0.2' : '0.05'}" pointer-events="none" />`;
                });
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
            const isActive = UIState.selectedImpactFilter === cat.l;
            const border = isActive ? '2px solid #fff' : '1px solid transparent';
            const opacity = (UIState.selectedImpactFilter && !isActive) ? '0.4' : '1';

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

export function renderClimateHeatmap(data) {
    const container = document.getElementById('climate-heatmap-container');
    if (!container) return;

    // Use passed data, or module state, or window fallback
    const rawData = data || UIState.climateData || window.climateData;

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
    renderMonthlyAverages(); // Update monthly list

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
            } else if (UIState.climateImpactFilter !== null) {
                // If filter is active, check data
                if (!pt) {
                    opacity = '0.1';
                } else {
                    const catIdx = getImpactCategory(pt.mean_impact);
                    if (catIdx !== UIState.climateImpactFilter) opacity = '0.1';
                }
            }

            if (pt) {
                const val = pt.mean_impact;
                const catIdx = getImpactCategory(val);

                // Dimming Logic (Filter by Impact Legend)
                if (UIState.climateImpactFilter !== null && catIdx !== UIState.climateImpactFilter) {
                    opacity = '0.1';
                }

                if (val < 0.5) color = "#4ade80"; // Green
                else if (val < 2.0) color = "#facc15"; // Yellow
                else if (val < 3.5) color = "#fb923c"; // Orange
                else if (val < 6.0) color = "#f87171"; // Red
                else color = "#c084fc"; // Purple

                if (UIState.isDark && val < 0.5) color = "#22c55e"; // Dark adjustment (green)

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

    // --- Smooth Night Curve Overlay ---
    try {
        const lat = (window.locManager && window.locManager.current) ? window.locManager.current.lat : 0;

        // Calculate points for every week (column center)
        const curvePoints = [];

        for (let w = 1; w <= cols; w++) {
            // Week Center X
            const cx = labelW + ((w - 1) * (cellW + gap)) + (cellW / 2);

            // Solar Calc
            const doy = (w - 1) * 7 + 3;
            const phi = lat * Math.PI / 180;
            const delta = 23.45 * (Math.PI / 180) * Math.sin(2 * Math.PI * (284 + doy) / 365);
            const term = -Math.tan(phi) * Math.tan(delta);

            let haRad = 0;
            if (term < -1) haRad = Math.PI;
            else if (term > 1) haRad = 0;
            else haRad = Math.acos(term);

            const halfDayHours = (haRad * 180 / Math.PI) / 15;
            const srHour = 12 - halfDayHours;
            const ssHour = 12 + halfDayHours;

            // Apply Dawn/Dusk Offset (-/+ 25 mins)
            const off = 25 / 60;
            const dawnHour = srHour - off;
            const duskHour = ssHour + off;

            // Map Hour to Y
            // Y = headerH + (hour * (cellH + gap))
            const getY = (hour) => headerH + (hour * (cellH + gap));

            curvePoints.push({ x: cx, ySr: getY(dawnHour), ySs: getY(duskHour) });
        }

        // Build Dawn Path (Top Night)
        // Start at Top-Left Corner
        let pathTop = `M ${labelW} ${headerH} `;
        // Line down to Left-Edge Start-of-Curve
        if (curvePoints.length > 0) pathTop += `L ${labelW} ${curvePoints[0].ySr} `;
        // Curve points
        curvePoints.forEach(p => pathTop += `L ${p.x} ${p.ySr} `);
        // Line to Right-Edge End-of-Curve
        if (curvePoints.length > 0) pathTop += `L ${totalW} ${curvePoints[curvePoints.length - 1].ySr} `;
        // Line to Top-Right Corner and Close
        pathTop += `L ${totalW} ${headerH} Z`;

        // Build Dusk Path (Bottom Night)
        // Start at Bottom-Left Corner
        let pathBottom = `M ${labelW} ${totalH} `;
        // Line up to Left-Edge Start-of-Curve
        if (curvePoints.length > 0) pathBottom += `L ${labelW} ${curvePoints[0].ySs} `;
        // Curve points
        curvePoints.forEach(p => pathBottom += `L ${p.x} ${p.ySs} `);
        // Line to Right-Edge End-of-Curve
        if (curvePoints.length > 0) pathBottom += `L ${totalW} ${curvePoints[curvePoints.length - 1].ySs} `;
        // Line to Bottom-Right Corner and Close
        pathBottom += `L ${totalW} ${totalH} Z`;

        svgInner += `<path d="${pathTop}" fill="#000" fill-opacity="0.3" pointer-events="none" />`;
        svgInner += `<path d="${pathBottom}" fill="#000" fill-opacity="0.3" pointer-events="none" />`;

    } catch (e) { console.warn('Climate curve error', e); }

    container.innerHTML = `<svg viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" style="width:100%; height:auto; display:block;">${svgInner}</svg>`;
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
        if (UIState.climateImpactFilter !== null && UIState.climateImpactFilter !== l.label) {
            opacity = '0.4';
        }

        let border = '1px solid transparent';
        let isActive = (UIState.climateImpactFilter === l.label);
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

export function renderForecastChart(containerId, dayLimit) {
    const cont = document.getElementById(containerId || 'forecast-chart-container');
    if (!cont || !UIState.forecastData || UIState.forecastData.length === 0) return;

    // Data Slicing
    let chartData = UIState.forecastData;
    if (dayLimit) {
        chartData = UIState.forecastData.slice(0, 24 * dayLimit);
    }

    // Dimensions (Responsive)
    // Use clientWidth but wait for layout if possible?
    const w = cont.clientWidth;
    const h = 180; // Fixed height
    if (w === 0) return; // Not visible yet

    const pad = { top: 20, right: 10, bottom: 20, left: 45 };
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
        svg += `<text x="${pad.left - 5}" y="${y + 3}" fill="var(--text-secondary)" font-size="9" text-anchor="end" style="pointer-events:none;">${Math.round(val)}<tspan font-size="7" dx="1">°C</tspan></text>`;
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
    if (UIState.selectedForeHour) {
        const idx = UIState.forecastData.findIndex(d => d.time === UIState.selectedForeHour);
        if (idx !== -1) {
            selectedX = getX(idx);
            svg += `<line x1="${selectedX}" y1="${pad.top}" x2="${selectedX}" y2="${h - pad.bottom}" stroke="var(--accent-color)" stroke-width="2" opacity="0.8" />`;
            // Highlight Dots
            const d = UIState.forecastData[idx];
            svg += `<circle cx="${selectedX}" cy="${getY(d.temp)}" r="4" fill="#f87171" stroke="white" stroke-width="2"/>`;
            svg += `<circle cx="${selectedX}" cy="${getY(d.dew)}" r="4" fill="#60a5fa" stroke="white" stroke-width="2"/>`;
        }
    }

    // Paths
    // Definitions for Gradients
    svg += `<defs>
        <linearGradient id="chartGradTemp" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#f87171" />
            <stop offset="50%" stop-color="#fbbf24" />
            <stop offset="100%" stop-color="#f87171" />
        </linearGradient>
        <linearGradient id="chartGradDew" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
        <linearGradient id="chartFillTemp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f87171" stop-opacity="0.2" />
            <stop offset="100%" stop-color="#f87171" stop-opacity="0" />
        </linearGradient>
    </defs>`;

    // Fill Area (Optional, implies closing path properly which is hard with simple line logic without calculating bottom points)
    // For now, simpler: Gradient Stroke.

    svg += `<path d="${pathDew}" fill="none" stroke="url(#chartGradDew)" stroke-width="2" stroke-linecap="round" />`;
    svg += `<path d="${pathTemp}" fill="none" stroke="url(#chartGradTemp)" stroke-width="2" stroke-linecap="round" />`;



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

export function renderRainChart(containerId, dayLimit) {
    const cont = document.getElementById(containerId || 'forecast-rain-chart-container-16');
    if (!cont || !UIState.forecastData || UIState.forecastData.length === 0) return;

    // Data Slicing
    let chartData = UIState.forecastData;
    if (dayLimit) {
        chartData = UIState.forecastData.slice(0, 24 * dayLimit);
    }

    const w = cont.clientWidth;
    const h = 180;
    if (w === 0) return;

    const pad = { top: 20, right: 30, bottom: 20, left: 30 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    // Scales
    const rains = chartData.map(d => d.rain || 0);
    const probs = chartData.map(d => d.prob || 0);

    // Y1 (Rain) Scale 0 to Max (min 5mm)
    let maxRain = Math.max(...rains, 5);
    maxRain = Math.ceil(maxRain);

    // Y2 (Prob) Scale 0 to 100
    const maxProb = 100;

    const getX = (i) => pad.left + (i / (chartData.length - 1)) * chartW;
    const getYRain = (val) => pad.top + chartH - (val / maxRain) * chartH;
    const getYProb = (val) => pad.top + chartH - (val / maxProb) * chartH;

    // Paths
    let pathProb = '';
    let hasStartedProb = false;

    // Build Bars (rects) and Line Path
    let barsHtml = '';

    const barW = Math.max(1, (chartW / chartData.length) - 1);

    chartData.forEach((d, i) => {
        const x = getX(i);

        // Rain Bar
        if (d.rain > 0) {
            const yR = getYRain(d.rain);
            const hR = (pad.top + chartH) - yR;
            // Center bar on point
            barsHtml += `<rect x="${x - barW / 2}" y="${yR}" width="${barW}" height="${hR}" fill="#60a5fa" opacity="0.8" />`;
        }

        // Prob Line
        if (d.prob != null) {
            const yP = getYProb(d.prob);
            const cmd = hasStartedProb ? 'L' : 'M';
            pathProb += `${cmd} ${x.toFixed(1)} ${yP.toFixed(1)} `;
            hasStartedProb = true;
        } else {
            hasStartedProb = false;
        }
    });

    let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="cursor:crosshair;">`;

    // Grid (Left Axis based - Rain)
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        const pct = i / steps;
        const y = pad.top + chartH - (pct * chartH);
        const valRain = pct * maxRain;
        const valProb = pct * maxProb;

        // Grid Line
        svg += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4 4" opacity="0.3" style="pointer-events:none;" />`;

        // Label Left (Rain)
        svg += `<text x="${pad.left - 5}" y="${y + 3}" fill="#60a5fa" font-size="9" text-anchor="end" style="pointer-events:none;">${Math.round(valRain)} <tspan font-size="7">mm</tspan></text>`;

        // Label Right (Prob)
        svg += `<text x="${w - pad.right + 5}" y="${y + 3}" fill="#93c5fd" font-size="9" text-anchor="start" style="pointer-events:none;">${Math.round(valProb)}%</text>`;
    }

    // Days Delimiter (Midnight) & Labels (Noon)
    chartData.forEach((d, i) => {
        const date = new Date(d.time);
        const hour = parseInt(d.time.substring(11, 13));
        const x = getX(i);

        // Midnight Line
        if (hour === 0 && i > 0) {
            svg += `<line x1="${x}" y1="${pad.top}" x2="${x}" y2="${h - pad.bottom}" stroke="var(--border-color)" stroke-width="1" opacity="0.3" />`;
        }

        // Noon Label
        if (hour === 12) {
            svg += `<text x="${x}" y="${h - 5}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${date.toLocaleDateString('en-US', { weekday: 'short' })}</text>`;
        }
    });

    // Selected Hour Highlight
    let selectedX = -1;
    if (UIState.selectedForeHour) {
        const idx = UIState.forecastData.findIndex(d => d.time === UIState.selectedForeHour);
        if (idx !== -1) {
            selectedX = getX(idx);
            // Highlight Line
            svg += `<line x1="${selectedX}" y1="${pad.top}" x2="${selectedX}" y2="${h - pad.bottom}" stroke="var(--accent-color)" stroke-width="2" opacity="0.8" />`;
            // Highlight Dot for Prob
            const d = UIState.forecastData[idx];
            svg += `<circle cx="${selectedX}" cy="${getYProb(d.prob || 0)}" r="4" fill="#93c5fd" stroke="white" stroke-width="2"/>`;
        }
    }

    // Render Bars
    svg += barsHtml;

    // Render Prob Line
    svg += `<path d="${pathProb}" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" />`;

    // Interaction Layer
    // NOTE: 'chart-interact' relies on handleChartClick in UI events.
    // The key for selection toggling (allow re-select to toggle off) is handled in 'toggleForeSelection'.
    // If handleChartClick works for other charts, it should work here. 
    // Is it possible CSS pointer-events or stacking is an issue?
    // Let's ensure this rect is ON TOP and has pointer events.
    svg += `<rect x="${pad.left}" y="${pad.top}" width="${chartW}" height="${chartH}" fill="white" fill-opacity="0" 
                            style="cursor:crosshair; pointer-events:all;"
                            data-action="chart-interact"
                            data-type="rain"
                            data-total-w="${w}"
                            data-chart-w="${chartW}"
                            data-pad-left="${pad.left}"
                            data-len="${chartData.length}" />`;

    svg += `</svg>`;
    cont.innerHTML = svg;
}


export function renderWindChart(containerId, dayLimit) {
    const cont = document.getElementById(containerId || 'forecast-wind-chart-container-16');
    if (!cont || !UIState.forecastData || UIState.forecastData.length === 0) return;

    // Data Slicing
    let chartData = UIState.forecastData;
    if (dayLimit) {
        chartData = UIState.forecastData.slice(0, 24 * dayLimit);
    }

    const w = cont.clientWidth;
    const h = 180;
    if (w === 0) return;

    const pad = { top: 20, right: 30, bottom: 20, left: 50 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    // Scales
    const winds = chartData.map(d => d.wind || 0);

    // Y Scale 0 to Max (min 20km/h for visual reasons)
    let maxWind = Math.max(...winds, 20);
    maxWind = Math.ceil(maxWind);

    const getX = (i) => pad.left + (i / (chartData.length - 1)) * chartW;
    const getY = (val) => pad.top + chartH - (val / maxWind) * chartH;

    // Paths
    let pathWind = '';
    let hasStarted = false;

    chartData.forEach((d, i) => {
        const x = getX(i);

        if (d.wind != null) {
            const y = getY(d.wind);
            const cmd = hasStarted ? 'L' : 'M';
            pathWind += `${cmd} ${x.toFixed(1)} ${y.toFixed(1)} `;
            hasStarted = true;
        } else {
            hasStarted = false;
        }
    });

    let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="cursor:crosshair;">`;

    // Grid (Left Axis based - Wind)
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        const pct = i / steps;
        const y = pad.top + chartH - (pct * chartH);
        const val = pct * maxWind;

        // Grid Line
        svg += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4 4" opacity="0.3" style="pointer-events:none;" />`;

        // Label Left (Wind)
        svg += `<text x="${pad.left - 5}" y="${y + 3}" fill="#c084fc" font-size="9" text-anchor="end" style="pointer-events:none;">${Math.round(val)} <tspan font-size="7">km/h</tspan></text>`;
    }

    // Days Delimiter (Midnight) & Labels (Noon)
    chartData.forEach((d, i) => {
        const date = new Date(d.time);
        const hour = parseInt(d.time.substring(11, 13));
        const x = getX(i);

        // Midnight Line
        if (hour === 0 && i > 0) {
            svg += `<line x1="${x}" y1="${pad.top}" x2="${x}" y2="${h - pad.bottom}" stroke="var(--border-color)" stroke-width="1" opacity="0.3" />`;
        }

        // Noon Label
        if (hour === 12) {
            svg += `<text x="${x}" y="${h - 5}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${date.toLocaleDateString('en-US', { weekday: 'short' })}</text>`;
        }
    });

    // Selected Hour Highlight
    let selectedX = -1;
    if (UIState.selectedForeHour) {
        const idx = UIState.forecastData.findIndex(d => d.time === UIState.selectedForeHour);
        if (idx !== -1) {
            selectedX = getX(idx);
            // Highlight Line
            svg += `<line x1="${selectedX}" y1="${pad.top}" x2="${selectedX}" y2="${h - pad.bottom}" stroke="var(--accent-color)" stroke-width="2" opacity="0.8" />`;
            // Highlight Dot for Wind
            const d = UIState.forecastData[idx];
            svg += `<circle cx="${selectedX}" cy="${getY(d.wind || 0)}" r="4" fill="#c084fc" stroke="white" stroke-width="2"/>`;
        }
    }

    // Render Line
    svg += `<path d="${pathWind}" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" />`;

    // Interaction Layer
    svg += `<rect x="${pad.left}" y="${pad.top}" width="${chartW}" height="${chartH}" fill="white" fill-opacity="0" 
                            style="cursor:crosshair; pointer-events:all;"
                            data-action="chart-interact"
                            data-type="wind"
                            data-total-w="${w}"
                            data-chart-w="${chartW}"
                            data-pad-left="${pad.left}"
                            data-len="${chartData.length}" />`;

    svg += `</svg>`;
    cont.innerHTML = svg;
}

export function renderCurrentTab(w, a, prob2h = 0, precip2h = 0, daily, elevation) {
    const container = document.getElementById('current-content');
    if (!container) return;

    // Update Elevation Displays (Global, since buttons are outside this container)
    document.querySelectorAll('.elevation-display').forEach(el => {
        if (elevation !== undefined && elevation !== null) {
            el.textContent = `${Math.round(elevation)}m`;
            el.style.display = 'block';
        } else {
            el.textContent = '';
            el.style.display = 'none';
        }
    });

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
    const cloud = w.cloud_cover != null ? w.cloud_cover : 0;

    // Cloud Color logic
    const getCloudColor = (c) => {
        if (c < 20) return '#60a5fa'; // Clear/Blue
        if (c < 60) return '#9ca3af'; // Partly Cloudy/Gray
        return '#6b7280'; // Overcast/Dark Gray
    };
    const getCloudText = (c) => {
        if (c < 20) return 'Clear';
        if (c < 60) return 'Partly Cld';
        return 'Overcast';
    };

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

    // Update global store for copy
    UIState.currentWeatherData = w;
    UIState.dailyForecast = daily; // Store daily data specifically for Heatmap Shading lookup

    // Header structure is now static in index.html
    let html = '';

    // Helper for info icon


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
                        <div style="${headStyle}"><svg class="icon-float" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg> Wind</div>
                        <div style="${gridStyle}">
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Speed ${infoIcon('Wind Speed', 'Sustained wind speed at 10m height.<br><br><span style=&quot;color:#4ade80&quot;><b>< 10 km/h (Calm):</b></span> No impact.<br><span style=&quot;color:#facc15&quot;><b>10-20 km/h (Light):</b></span> Barely noticeable.<br><span style=&quot;color:#fb923c&quot;><b>20-30 km/h (Moderate):</b></span> Effort increases.<br><span style=&quot;color:#f87171&quot;><b>30-40 km/h (Strong):</b></span> Pace unreliable.<br><span style=&quot;color:#c084fc&quot;><b>> 40 km/h (Severe):</b></span> Running compromised.')}</div>
                                <div style="${valStyle}; color:${getCondColor('wind', wind)}">${safeVal(wind)} <span style="font-size:0.7em">km/h</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Gusts ${infoIcon('Wind Gusts', 'Maximum instantaneous wind speed at 10 meters.<br><br><span style=&quot;color:#4ade80&quot;><b>< 20 km/h (Minimal):</b></span> Safe.<br><span style=&quot;color:#facc15&quot;><b>20-30 km/h (Noticeable):</b></span> Breezy.<br><span style=&quot;color:#fb923c&quot;><b>30-40 km/h (Strong):</b></span> Drag.<br><span style=&quot;color:#f87171&quot;><b>40-60 km/h (Very Strong):</b></span> Unsafe.<br><span style=&quot;color:#c084fc&quot;><b>> 60 km/h (Severe):</b></span> Dangerous.')}</div>
                                <div style="${valStyle}; color:${getCondColor('gust', windGust)}">${safeVal(windGust)} <span style="font-size:0.7em">km/h</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Direction</div>
                                <div style="${valStyle}">${windDirStr} <span style="font-size:0.7em; color:var(--text-secondary);">(${dir}°)</span></div>
                            </div>
                        </div>
                    </div>`;

    html += `<div style="${sectionStyle}">
                        <div style="${headStyle}"><svg class="icon-pulse" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="16" y1="13" x2="16" y2="21"></line><line x1="8" y1="13" x2="8" y2="21"></line><line x1="12" y1="15" x2="12" y2="23"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg> Precipitation</div>
                        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; row-gap:16px; align-items: stretch;">
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Rain (2h) ${infoIcon('Rain Forecast', 'Estimated total precipitation currently expected for the next 2 hours.')}</div>
                                <div style="${valStyle}; color:${getCondColor('rain', precip2h)}">${safeVal(precip2h)} <span style="font-size:0.7em">mm</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Chance ${infoIcon('Rain Probability', 'Probability of precipitation.<br><br><span style=&quot;color:#4ade80&quot;><b>< 30% (Low):</b></span> Unlikely.<br><span style=&quot;color:#fb923c&quot;><b>30-60% (Medium):</b></span> Possible.<br><span style=&quot;color:#f87171&quot;><b>> 60% (High):</b></span> Look for shelter.')}</div>
                                <div style="${valStyle}; color:${getCondColor('prob', prob2h)}">${prob2h} <span style="font-size:0.7em">%</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Clouds ${infoIcon('Cloud Coverage', 'Percentage of sky covered by clouds.<br><br><span style=&quot;color:#60a5fa&quot;><b>0-20% (Clear):</b></span> Sunny.<br><span style=&quot;color:#9ca3af&quot;><b>20-60% (Partly):</b></span> Mixed.<br><span style=&quot;color:#6b7280&quot;><b>> 60% (Overcast):</b></span> Cloudy.')}</div>
                                <div style="${valStyle}; color:${getCloudColor(cloud)}">${cloud} <span style="font-size:0.7em">%</span></div>
                            </div>
                        </div>
                    </div>`;

    // 4. Radiation & Air
    // Remove local aqiColor logic in favor of getCondColor helper

    html += `<div style="${sectionStyle}">
                        <div style="${headStyle}"><svg class="icon-spin" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg> Radiation & Air</div>
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

    // Freshness Footer: Store timestamp and show relative time
    const dataTime = w.time; // ISO string from Open-Meteo (e.g., "2024-01-15T14:00")
    UIState.currentDataTimestamp = dataTime ? new Date(dataTime) : new Date();

    const freshnessFooter = `<div id="data-freshness" style="text-align:center; padding:12px 0 4px; font-size:0.7rem; color:var(--text-secondary); opacity:0.6;"></div>`;

    container.innerHTML = gridWrapper + html + gridEnd + freshnessFooter;
    container.querySelector('div').classList.add('current-cards-grid');

    // Update the freshness text immediately and start interval
    updateFreshnessText();
    startFreshnessUpdater();
}

// --- Freshness Updater Logic ---
let freshnessIntervalId = null;

function updateFreshnessText() {
    const el = document.getElementById('data-freshness');
    if (!el || !UIState.currentDataTimestamp) return;

    const now = new Date();
    const diff = now - UIState.currentDataTimestamp;
    const mins = Math.floor(diff / 60000);

    let text;
    if (mins < 1) text = 'Updated just now';
    else if (mins === 1) text = 'Updated 1 min ago';
    else if (mins < 60) text = `Updated ${mins} min ago`;
    else {
        const hrs = Math.floor(mins / 60);
        text = hrs === 1 ? `Updated 1 hr ago` : `Updated ${hrs} hrs ago`;
    }
    el.textContent = text;
}

function startFreshnessUpdater() {
    // Clear previous interval to avoid duplicates
    if (freshnessIntervalId) clearInterval(freshnessIntervalId);
    // Update every 30 seconds
    freshnessIntervalId = setInterval(updateFreshnessText, 30000);
}

export function renderOverview() {
    // Placeholder if needed
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

    return bestHour.time; // Return for auto-selection
}

function getNightShadingSVG(daily, chartW, chartH, pad, chartData) {
    let shading = '';
    if (daily && daily.time) {
        const dTimes = daily.time;
        const sunrises = daily.sunrise;
        const sunsets = daily.sunset;

        // Iterate days in daily forecast
        for (let i = 0; i < dTimes.length; i++) {
            // Logic: Night is from Sunset(i) -> Sunrise(i+1)
            const sunset = new Date(sunsets[i]).getTime();
            let nextSunrise = null;
            if (i < dTimes.length - 1) {
                nextSunrise = new Date(sunrises[i + 1]).getTime();
            } else {
                continue; // Skip end of range
            }

            const dataStart = new Date(chartData[0].time).getTime();
            const dataEnd = new Date(chartData[chartData.length - 1].time).getTime();
            const totalMs = dataEnd - dataStart;

            // Check overlap
            if (nextSunrise < dataStart || sunset > dataEnd) continue;

            // Clamp
            const startMs = Math.max(sunset, dataStart);
            const endMs = Math.min(nextSunrise, dataEnd);

            if (startMs >= endMs) continue;

            const startPct = (startMs - dataStart) / totalMs;
            const endPct = (endMs - dataStart) / totalMs;

            const x1 = pad.left + (startPct * chartW);
            const x2 = pad.left + (endPct * chartW);
            const width = x2 - x1;

            if (width > 0) {
                shading += `<rect x="${x1}" y="${pad.top}" width="${width}" height="${chartH}" fill="rgba(0,0,0,0.2)" />`;
            }
        }

        // Special Case: Pre-dawn on First Day (Start of Chart -> Sunrise(0))
        if (chartData.length > 0 && sunrises.length > 0) {
            const firstSunrise = new Date(sunrises[0]).getTime();
            const dataStart = new Date(chartData[0].time).getTime();

            if (dataStart < firstSunrise) {
                const dataEnd = new Date(chartData[chartData.length - 1].time).getTime();
                const totalMs = dataEnd - dataStart;
                const endMs = Math.min(firstSunrise, dataEnd);

                if (endMs > dataStart) {
                    const width = ((endMs - dataStart) / totalMs) * chartW;
                    shading += `<rect x="${pad.left}" y="${pad.top}" width="${width}" height="${chartH}" fill="rgba(0,0,0,0.2)" />`;
                }
            }
        }
    }
    return shading;
}

// --- Monthly Averages ---
export function renderMonthlyAverages(data) {
    const container = document.getElementById('monthly-averages-content');
    if (!container) return;

    // Use passed data or global
    const rawData = data || UIState.climateData || window.climateData;
    if (!rawData || !Array.isArray(rawData)) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">No data available</div>';
        return;
    }

    const months = Array.from({ length: 12 }, (_, i) => ({
        index: i,
        name: new Date(2025, i, 1).toLocaleString('en-US', { month: 'short' }),
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
        const d = new Date(2025, 0, 1 + (weekNum - 1) * 7 + 3);
        const mIdx = d.getMonth();

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
        const daysInMonth = new Date(2025, m.index + 1, 0).getDate();
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
    const currentMIdx = new Date().getMonth();

    months.forEach(m => {
        const isCurrent = (m.index === currentMIdx);
        const rowBg = isCurrent ? 'background:rgba(255,255,255,0.05); border-radius:6px;' : '';

        // Temperature bar
        let tempLeft = 0, tempWidth = 0, tempLabelL = '', tempLabelR = '', tempBarStyle = '';
        if (m.weeks.length > 0) {
            tempLeft = ((m.stats.min - tempGlobalMin) / tempRange) * 100;
            tempWidth = ((m.stats.max - m.stats.min) / tempRange) * 100;
            tempLabelL = Math.round(m.stats.min) + '°';
            tempLabelR = Math.round(m.stats.max) + '°';

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
            rainLabel = (m.stats.rain / 10).toFixed(1) + 'cm';
        }

        html += `
        <div class="monthly-row monthly-row-animated" style="display:flex; align-items:center; margin-bottom:8px; padding:6px 8px; font-size:0.85rem; ${rowBg}; animation-delay:${m.index * 0.05}s;">
            <div style="width:35px; color:var(--text-secondary); font-weight:500; text-transform:capitalize;">${m.name}</div>
            
            <!-- Temperature Section -->
            <div class="monthly-temp-section" style="flex:1; display:flex; align-items:center; margin-right:20px;">
                <div class="monthly-label" style="width:30px; text-align:right; color:var(--text-primary); font-weight:600; margin-right:8px; font-variant-numeric:tabular-nums; font-size:0.8rem;">
                    ${tempLabelL}
                </div>
                <div style="flex:1; position:relative; height:20px;">
                    <div style="background:rgba(255,255,255,0.08); height:4px; border-radius:2px; width:100%; position:absolute; top:50%; transform:translateY(-50%);"></div>
                    <div class="monthly-bar-animated" style="${tempBarStyle}"></div>
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
// window.selectedMonthlyType is no longer needed

window.toggleMonthlyAverages = () => {
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
};
