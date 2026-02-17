import { UIState } from './state.js';
import { getImpactHeatmapColor, getImpactCategory, getBasePaceSec } from './utils.js';
import { getISOWeek } from '../core.js';
import { renderClimateTable } from './tables.js';
import { renderMonthlyAverages } from './climate.js';
import { AppState } from '../appState.js';

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
    const getLocalIso = (timeZone) => {
        const now = new Date();
        const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false };
        if (timeZone) options.timeZone = timeZone;
        const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
        const p = {};
        parts.forEach(({ type, value }) => p[type] = value);
        return `${p.year}-${p.month}-${p.day}T${p.hour}`;
    };
    const forecastTimeZone = AppState.weatherData && AppState.weatherData.timezone
        ? AppState.weatherData.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
    let currentIsoPrefix = '';
    try {
        currentIsoPrefix = getLocalIso(forecastTimeZone);
    } catch (e) {
        currentIsoPrefix = getLocalIso();
    }

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

                if (d.temp != null && d.dew != null && AppState.hapCalc) {
                    const adjPace = AppState.hapCalc.calculatePaceInHeat(baseSec, d.temp, d.dew);
                    pct = ((adjPace - baseSec) / baseSec) * 100;
                    color = getImpactHeatmapColor(pct);
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
                    class="heatmap-cell"
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

    cont.innerHTML = `<svg viewBox="0 0 ${totalW} ${totalH}" class="heatmap-svg">${svgInner}</svg>`;

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
            const stateClass = `legend-state-${cat.l.toLowerCase()}`;

            lHtml += `
                <div class="legend-item legend-item--interactive ${stateClass}" data-action="filter-impact" data-category="${cat.l}" style="--legend-opacity:${opacity};">
                    <div class="legend-color legend-color--dynamic" style="--legend-color:${cat.c}; --legend-border:${border}; --legend-shadow:${isActive ? '0 0 8px ' + cat.c : 'none'};"></div>
                    <span>${cat.l} <span class="legend-sub">(${cat.lt})</span></span>
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
    const rawData = data || UIState.climateData;

    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
        // Only warn if we actually expected data (e.g. not just initial load)
        // But for now, let's just show loading text
        container.innerHTML = '<div class="heatmap-empty">No climate data available yet.</div>';
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
            if (UIState.selectedClimateKey) {
                const [sw, sh] = UIState.selectedClimateKey.split('-').map(Number);
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

                color = getImpactHeatmapColor(val);

                // Highlight Current Time
                if (w === curW && h === curH) {
                    stroke = 'stroke="#3b82f6" stroke-width="2" paint-order="stroke"';
                } else if (UIState.selectedClimateKey === `${w}-${h}`) {
                    stroke = 'stroke="#fff" stroke-width="2" paint-order="stroke"';
                }


                svgInner += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="1"
                        fill="${color}" fill-opacity="${opacity}" ${stroke}
                        class="heatmap-cell"
                        data-action="climate-cell"
                        data-week="${w}" data-hour="${h}"
                        data-impact="${val}" data-temp="${pt.mean_temp}" data-dew="${pt.mean_dew}" data-count="${pt.count}"
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
        const lat = (AppState.locManager && AppState.locManager.current) ? AppState.locManager.current.lat : 0;

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

    container.innerHTML = `<svg viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" class="heatmap-svg">${svgInner}</svg>`;
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
        const stateClass = `legend-state-${l.label.toLowerCase()}`;

        html += `
                        <div class="legend-item legend-item--interactive ${stateClass}" data-action="filter-climate-impact" data-label="${l.label}" style="--legend-opacity:${opacity};">
                            <div class="legend-color legend-color--dynamic" style="--legend-color:${l.color}; --legend-border:${border}; --legend-shadow:${isActive ? '0 0 8px ' + l.color : 'none'};"></div>
                            <span>${l.label} <span class="legend-sub">(${l.sub})</span></span>
                        </div>
                    `;
    });

    container.innerHTML = html;
}
