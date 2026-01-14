
// UI Module - Reconstructed
import { HAPCalculator, VDOT_MATH, parseTime, formatTime, getEasyPace, getISOWeek } from './core.js';
import { calculatePacingState, calculateWBGT } from './engine.js';
import { fetchWeatherData, searchCity, fetchIpLocation, reverseGeocode } from './api.js';
import { saveToStorage } from './storage.js';
export { renderCurrentTab, renderForecastChart, renderClimateTable, renderClimateLegend, renderClimateHeatmap, renderForecastHeatmap, renderForecastTable, renderVDOTDetails, renderAllForecasts, renderOverview, calculateBestRunTime } from './ui/renderers.js';
import { UIState } from './ui/state.js';
export { UIState };
import { infoIcon, getImpactColor, getDewColor, getCondColor, getImpactCategory, getBasePaceSec, getDateFromWeek } from './ui/utils.js';
export { infoIcon, getImpactColor, getDewColor, getCondColor, getImpactCategory, getBasePaceSec, getDateFromWeek };
import { openTab, setPaceMode, toggleForeSort, setBestRunRange, toggleImpactFilter, copyConditions, sortForecastTable, handleCellHover, showForeTooltip, moveForeTooltip, hideForeTooltip } from './ui/events.js';
export { openTab, setPaceMode, toggleForeSort, setBestRunRange, toggleImpactFilter, copyConditions, sortForecastTable, handleCellHover, showForeTooltip, moveForeTooltip, hideForeTooltip };

// Legacy Window Bindings for HTML Event Handlers
window.openTab = openTab;
window.setPaceMode = setPaceMode;
window.toggleForeSort = toggleForeSort;
window.setBestRunRange = setBestRunRange;
window.toggleImpactFilter = toggleImpactFilter;
window.copyConditions = copyConditions;
window.sortForecastTable = sortForecastTable;
window.handleCellHover = handleCellHover;
window.showForeTooltip = showForeTooltip;
window.moveForeTooltip = moveForeTooltip;
// Internal handlers remaining in ui.js need window binding for HTML
window.toggleForeSelection = toggleForeSelection;
window.toggleVDOTDetails = toggleVDOTDetails;
window.handleChartHover = handleChartHover;
window.handleChartClick = handleChartClick;
window.showClimateTooltip = showClimateTooltip;
window.moveClimateTooltip = moveClimateTooltip;
window.hideClimateTooltip = hideClimateTooltip;
window.filterClimateByImpact = filterClimateByImpact;
window.toggleDarkMode = toggleDarkMode; // Was exported but maybe used in HTML?
// But app.js code used `window.hapCalc`.
// Assuming core.js has HAPCalculator
// But app.js code used `window.hapCalc`.

// Expose these via window for legacy compatibility (read from window in funcs)
// OR just rely on module scope if functions use them directly.
// To support "window.selectedImpactFilter" style in existing code, we might need to sync them
// But based on errors, code is trying to read variable directly in module scope?
// "ReferenceError: UIState.selectedImpactFilter is not defined" suggests code uses bare variable.
// If code uses `window.selectedImpactFilter`, it wouldn't be RefErr (it would be undefined).

export function toggleDarkMode() {
    UIState.isDark = !UIState.isDark;
    window.isDark = UIState.isDark;
    if (UIState.isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    // Re-render things that depend on theme colors
    renderClimateHeatmap();
}

export function setForecastData(d) { UIState.forecastData = d; }
export function setClimateData(d) {
    UIState.climateData = d;
    window.climateData = d;
}

// We will rely on window.hapCalc for now to minimize breakage inside the extracted blocks.

// --- Helpers ---
// infoIcon was local in renderCurrentTab, duplicating here for shared use if needed
// infoIcon was local in renderCurrentTab, duplicating here for shared use if needed
// date/time format helpers
// formatTime imported from core.js


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
    const titleHtml = title ? `<div style="font-weight:600; margin-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:4px;">${title}</div>` : '';
    const html = `
                        ${titleHtml}
                        <div style="font-size:0.85em; opacity:0.9; line-height:1.4;">${text}</div>
                    `;

    el.innerHTML = html;
    el.style.display = 'block';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto'; // Fix: Re-enable clicks
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

export function toggleForeSelection(isoTime, e) {
    if (e) e.stopPropagation();
    if (isoTime === null) {
        UIState.selectedForeHour = null;
    } else {
        if (UIState.selectedForeHour === isoTime) {
            UIState.selectedForeHour = null;
        } else {
            UIState.selectedForeHour = isoTime;
            window.selectedForeHour = isoTime;
        }
    }
    renderAllForecasts();
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
    const len = dataLen || UIState.forecastData.length;
    let idx = Math.round(ratio * (len - 1));
    idx = Math.max(0, Math.min(idx, len - 1)); // Clamp to bounds
    if (idx >= 0 && idx < UIState.forecastData.length) {
        const d = UIState.forecastData[idx];

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
    const ratio = mouseX / rect.width; // Fix: Use rendered width, not SVG logic width
    const len = dataLen || UIState.forecastData.length;
    const idx = Math.round(ratio * (len - 1));
    if (idx >= 0 && idx < UIState.forecastData.length) {
        const d = UIState.forecastData[idx];
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
    if (UIState.climateImpactFilter === idx) {
        UIState.climateImpactFilter = null;
        // Clear dimming
        if (el && el.parentElement) el.parentElement.querySelectorAll('.legend-item').forEach(e => e.classList.remove('opacity-20'));
    } else {
        UIState.climateImpactFilter = idx;
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

export function sortClimate(col) {
    if (UIState.climateSortCol === col) {
        UIState.climateSortDir = (UIState.climateSortDir === 'asc') ? 'desc' : 'asc';
    } else {
        UIState.climateSortCol = col;
        UIState.climateSortDir = 'desc'; // Default high impact/temp first
        if (col === 'date' || col === 'hour') UIState.climateSortDir = 'asc';
    }
    renderClimateTable();
}

export function toggleClimateFilter(w, h, e) {
    if (e) e.stopPropagation(); // Essential to prevent document click from clearing selection immediately
    if (w === null) {
        UIState.selectedClimateKey = null;
    } else {
        const key = `${w}-${h}`;
        if (UIState.selectedClimateKey === key) {
            UIState.selectedClimateKey = null;
        } else {
            UIState.selectedClimateKey = key;
        }
    }
    // Sync window for any legacy listeners
    window.selectedClimateKey = UIState.selectedClimateKey;

    renderClimateTable();
    renderClimateHeatmap(); // Update opacity
    renderClimateLegend(); // Update legend
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

export function setupWindowHelpers() {
    console.log("Window Helpers Setup");

    // Global click listener for deselecting
    document.addEventListener('click', (e) => {
        // Ignore clicks on elements that have been removed from DOM (e.g. due to re-renders)
        if (!document.body.contains(e.target)) return;

        // Forecast Deselection
        if (window.selectedForeHour) {
            // Updated IDs for 16-day forecast
            const chart = document.getElementById('forecast-chart-container-16');
            const legend = document.getElementById('legend-container-16');
            const isOutsideChart = !chart || !chart.contains(e.target);
            const isOutsideLegend = !legend || !legend.contains(e.target);
            // Also check if target is the interaction layer (though inside chart) or specific buttons
            console.log('Click check Forecast:', { isOutsideChart, isOutsideLegend, target: e.target });

            if (isOutsideChart && isOutsideLegend) {
                console.log("Deselecting Forecast");
                toggleForeSelection(null);
            }
        }

        // Climate Deselection
        if (window.selectedClimateKey) {
            const cmap = document.getElementById('climate-heatmap-container');
            const cleg = document.getElementById('climate-legend-container'); // Check if this ID is correct in renderers
            if ((!cmap || !cmap.contains(e.target)) && (!cleg || !cleg.contains(e.target))) {
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
            if (UIState.forecastData && UIState.forecastData.length > 0) {
                renderForecastChart('forecast-chart-container-16', 14);
            }
            // Re-render heatmaps if needed
            renderForecastHeatmap('forecast-grid-container-16', '#legend-container-16', 14);
            renderClimateHeatmap();
        }, 150); // Debounce
    });
}

export function update(els, hapCalc) {
    // 1. Read Inputs
    const state = {
        distance: parseFloat(els.distance.value) || 0,
        timeSec: parseTime(els.time.value),
        temp: parseFloat(els.temp.value),
        dew: parseFloat(els.dew.value),
        wind: parseFloat(els.wind ? els.wind.value : 0),
        runnerWeight: window.runnerWeight || 65
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

        // Build the content columns
        let cols = [];

        // 1. Base Pace (Always Shown)
        cols.push({
            label: "Base",
            paceSec: pace,
            color: "#e6edf3", // default text color
            isBase: true
        });
        // Toggle State (Global or default to false)
        const view = window.pace_view || { heat: false, headwind: false, tailwind: false };

        // 2. Heat Adjusted (if valid AND toggled)
        if (view.heat && res.weather.valid && res.weather.adjustedPaces[key]) {
            const adj = res.weather.adjustedPaces[key];
            // Show even if insignificant? Or keeping logic? Let's keep logic but allow toggle to FORCE show if active?
            // Actually, usually user wants to see "what is the adjustment".
            // If toggle is ON, we show it (unless it's 0/invalid).
            if (adj > 0 && adj !== pace) {
                cols.push({
                    label: "Heat",
                    paceSec: adj,
                    color: impactColor
                });
            }
        }
        // 3. Wind Adjusted (Head/Tail)
        if (res.weather.windPaces && res.weather.windPaces[key]) {
            const wp = res.weather.windPaces[key];

            // Headwind
            if (view.headwind && wp.headwind && wp.headwind > 0) {
                cols.push({
                    label: "Headwind",
                    paceSec: wp.headwind,
                    color: "#f87171" // Soft Red (Tailwind Red-400)
                });
            }

            // Tailwind
            if (view.tailwind && wp.tailwind && wp.tailwind > 0) {
                cols.push({
                    label: "Tailwind",
                    paceSec: wp.tailwind,
                    color: "#4ade80" // Soft Green (Tailwind Green-400)
                });
            }
        }
        // Render HTML Container
        // Use Flexbox for columns
        let htmlCanvas = `<div style="display:flex; gap:8px; justify-content: flex-end; align-items:flex-start;">`;

        cols.forEach((col, i) => {
            // Inner content: Pace on top, Distance below
            let innerHtml = "";
            // Pace
            innerHtml += `<div style="font-weight:${col.isBase ? '600' : '500'}; color:${col.color}; white-space:nowrap; font-size:1em;">
                            ${formatTime(col.paceSec)}/km
                          </div>`;

            // Distance (if applicable)
            if (distDuration > 0) {
                const dMeters = Math.round((distDuration / col.paceSec) * 1000);
                innerHtml += `<div style="font-size:0.8em; opacity:0.8; color:${col.color}; margin-top:2px;">
                                 ${dMeters} m
                               </div>`;
            }
            // Wrapper for the column
            let labelHtml = "";
            if (!col.isBase) {
                labelHtml = `<div style="font-size:0.65em; text-transform:uppercase; letter-spacing:0.5px; opacity:0.6; margin-bottom:2px;">${col.label}</div>`;
            } else {
                // Explicit BASE label if others exist, or if we want clarity
                if (cols.length > 1) {
                    labelHtml = `<div style="font-size:0.65em; text-transform:uppercase; letter-spacing:0.5px; opacity:0.4; margin-bottom:2px;">Base</div>`;
                }
            }

            htmlCanvas += `<div style="display:flex; flex-direction:column; align-items:center; min-width:60px;">
                                ${labelHtml}
                                ${innerHtml}
                           </div>`;
            // Add divider if not last
            if (i < cols.length - 1) {
                htmlCanvas += `<div style="width:1px; background:rgba(255,255,255,0.1); align-self:stretch; margin:0 4px;"></div>`;
            }
        });

        htmlCanvas += `</div>`;
        // We replace elPace content with the canvas.
        elPace.innerHTML = htmlCanvas;
        // Hide separate distance element logic
        if (elDist) {
            elDist.innerHTML = "";
            elDist.style.display = "none";
        }
    };

    // Render Cards
    renderRow('p10min', els.pace10, els.dist10, 600);
    renderRow('p6min', els.pace6, els.dist6, 360);
    renderRow('p3min', els.pace3, els.dist3, 180);
    renderRow('easy', els.paceEasy, null, 0);

    // Impact Text - Heat
    if (res.weather.valid) {
        if (els.weatherImpact) {
            const heatInfoIcon = `<span onclick="window.showInfoTooltip(event, '', 'Pace adjustment from Hot-weather pace calculator by &lt;a href=&quot;https://apps.runningwritings.com/heat-adjusted-pace/&quot; target=&quot;_blank&quot;&gt;John Davis&lt;/a&gt;.')" style="cursor:pointer; opacity:0.5; position:absolute; top:4px; right:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span>`;
            els.weatherImpact.innerHTML = `Heat Impact: <span style="color:${impactColor}">~${res.weather.impactPct.toFixed(1)}% slowdown</span>${heatInfoIcon}`;
        }
    } else {
        if (els.weatherImpact) els.weatherImpact.textContent = "";
    }

    // Impact Text - Wind
    if (els.windImpact) {
        if (res.weather.windImpact) {
            const { headwindPct, tailwindPct } = res.weather.windImpact;
            // Format: "Headwind -X% | Tailwind +Y%"
            // Use specific colors: Red for Headwind, Green for Tailwind
            let html = "";

            // Headwind (Slowdown)
            if (Math.abs(headwindPct) > 0.1) {
                html += `<div style="margin-bottom:4px;">Headwind<br><span style="color:#f87171">~${headwindPct.toFixed(1)}% slowdown</span></div>`;
            }

            // Tailwind (Increase/Speedup)
            if (Math.abs(tailwindPct) > 0.1) {
                const val = Math.abs(tailwindPct);
                html += `<div>Tailwind<br><span style="color:#22c55e">~${val.toFixed(1)}% faster</span></div>`;
            }
            if (!html) html = "Wind Impact: Negligible";
            const windInfoIcon = `<span onclick="window.showInfoTooltip(event, '', 'Pace adjustment from Headwind and tailwind calculator by &lt;a href=&quot;https://apps.runningwritings.com/wind-calculator&quot; target=&quot;_blank&quot;&gt;John Davis&lt;/a&gt;.')" style="cursor:pointer; opacity:0.5; position:absolute; top:4px; right:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span>`;

            els.windImpact.innerHTML = html + windInfoIcon;
        } else {
            els.windImpact.textContent = "";
        }
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

// Redefine at end to ensure dependencies
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

// --- Infinite Scroll State ---

export function setupTableScrollListeners() {
    if (UIState.isScrollListenersSetup) return;

    // Forecast Table - use correct ID
    const foreBody = document.getElementById('forecast-body-16');
    const foreWrapper = foreBody?.closest('.table-wrapper');
    if (foreWrapper) {
        foreWrapper.addEventListener('scroll', () => {
            if (UIState.isBatchLoading) return;
            if (foreWrapper.scrollTop + foreWrapper.clientHeight >= foreWrapper.scrollHeight - 150) {
                UIState.isBatchLoading = true;
                renderForecastTable('forecast-body-16', 14, true);
                setTimeout(() => { UIState.isBatchLoading = false; }, 200);
            }
        });
    }
    // Climate Table
    const climBody = document.getElementById('climateTableBody');
    const climWrapper = climBody?.closest('.table-wrapper');
    if (climWrapper) {
        climWrapper.addEventListener('scroll', () => {
            if (UIState.isBatchLoading) return;
            if (climWrapper.scrollTop + climWrapper.clientHeight >= climWrapper.scrollHeight - 150) {
                UIState.isBatchLoading = true;
                renderClimateTable(true);
                setTimeout(() => { UIState.isBatchLoading = false; }, 200);
            }
        });
    }

    UIState.isScrollListenersSetup = true;
    console.log("Virtual Scroll Ready");
}

