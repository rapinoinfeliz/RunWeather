
// UI Module - Reconstructed
import { HAPCalculator, VDOT_MATH, parseTime, formatTime, getEasyPace, getISOWeek } from './core.js';
import { calculatePacingState, calculateWBGT, calculateAgeGrade } from './engine.js';
import { fetchWeatherData, searchCity, fetchIpLocation, reverseGeocode } from './api.js';
import { saveToStorage, loadFromStorage } from './storage.js';
import { AppState } from './appState.js';
import { AppStore, StoreActions, RequestKeys, beginRequest, endRequest, isRequestCurrent, cancelRequest } from './store.js';
import { renderCurrentTab, renderForecastChart, renderRainChart, renderWindChart, renderClimateTable, renderClimateLegend, renderClimateHeatmap, renderForecastHeatmap, renderForecastTable, renderVDOTDetails, renderAllForecasts, renderOverview, calculateBestRunTime, renderMonthlyAverages, toggleMonthlyAverages } from './ui/renderers.js';
export { renderCurrentTab, renderForecastChart, renderRainChart, renderWindChart, renderClimateTable, renderClimateLegend, renderClimateHeatmap, renderForecastHeatmap, renderForecastTable, renderVDOTDetails, renderAllForecasts, renderOverview, calculateBestRunTime, renderMonthlyAverages, toggleMonthlyAverages };
import { UIState } from './ui/state.js';
export { UIState };
import { infoIcon, getImpactColor, getDewColor, getCondColor, getImpactCategory, getBasePaceSec, getDateFromWeek, animateValue, showToast, updateWeatherTabState } from './ui/utils.js';
export { infoIcon, getImpactColor, getDewColor, getCondColor, getImpactCategory, getBasePaceSec, getDateFromWeek, animateValue, showToast, updateWeatherTabState };
import { openTab, setPaceMode, toggleForeSort, setBestRunRange, toggleImpactFilter, copyConditions, sortForecastTable, handleCellHover, showForeTooltip, moveForeTooltip, hideForeTooltip } from './ui/events.js';
export { openTab, setPaceMode, toggleForeSort, setBestRunRange, toggleImpactFilter, copyConditions, sortForecastTable, handleCellHover, showForeTooltip, moveForeTooltip, hideForeTooltip };
import { initRipple } from './ui/effects.js';

function appendLocationLabel(container, name, subText, subClass) {
    const label = document.createElement('div');
    label.appendChild(document.createTextNode(name || 'Unknown'));

    if (subText) {
        label.appendChild(document.createTextNode(' '));
        const sub = document.createElement('span');
        sub.className = subClass;
        sub.textContent = subText;
        label.appendChild(sub);
    }

    container.appendChild(label);
}

let locationSearchDebounceTimer = null;
let locationSearchSeq = 0;

function setChartCardCollapsedState(wrapper, collapsed) {
    const card = wrapper?.closest('.forecast-card');
    if (!card) return;
    card.classList.toggle('chart-card-collapsed', collapsed);
}


// --- Chart Toggle Functions ---
export function toggleTempChart() {
    const wrapper = document.getElementById('temp-chart-wrapper');
    const icon = document.getElementById('temp-toggle-icon');
    if (!wrapper || !icon) return;

    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
        setChartCardCollapsedState(wrapper, false);
        saveToStorage('temp_chart_collapsed', false);
        renderForecastChart('forecast-chart-container-16', 14);
    } else {
        wrapper.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
        setChartCardCollapsedState(wrapper, true);
        saveToStorage('temp_chart_collapsed', true);
    }
}

// Restore Temp Chart State
const savedTempState = loadFromStorage('temp_chart_collapsed');
if (savedTempState === true) {
    const wrapper = document.getElementById('temp-chart-wrapper');
    const icon = document.getElementById('temp-toggle-icon');
    if (wrapper) wrapper.style.display = 'none';
    if (wrapper) setChartCardCollapsedState(wrapper, true);
    if (icon) icon.style.transform = 'rotate(-90deg)';
}

export function toggleWindChart() {
    const wrapper = document.getElementById('wind-chart-wrapper');
    const icon = document.getElementById('wind-toggle-icon');
    if (!wrapper || !icon) return;

    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
        setChartCardCollapsedState(wrapper, false);
        saveToStorage('wind_chart_collapsed', false);
        renderWindChart('forecast-wind-chart-container-16', 14);
    } else {
        wrapper.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
        setChartCardCollapsedState(wrapper, true);
        saveToStorage('wind_chart_collapsed', true);
    }
}

// Restore Wind Chart State
const savedWindState = loadFromStorage('wind_chart_collapsed');
if (savedWindState === true) {
    const wrapper = document.getElementById('wind-chart-wrapper');
    const icon = document.getElementById('wind-toggle-icon');
    if (wrapper) wrapper.style.display = 'none';
    if (wrapper) setChartCardCollapsedState(wrapper, true);
    if (icon) icon.style.transform = 'rotate(-90deg)';
}

export function toggleRainChart() {
    const wrapper = document.getElementById('rain-chart-wrapper');
    const icon = document.getElementById('rain-toggle-icon');
    if (!wrapper || !icon) return;

    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
        setChartCardCollapsedState(wrapper, false);
        saveToStorage('rain_chart_collapsed', false);
        renderRainChart('forecast-rain-chart-container-16', 14);
    } else {
        wrapper.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
        setChartCardCollapsedState(wrapper, true);
        saveToStorage('rain_chart_collapsed', true);
    }
}

// Restore Rain Chart State
const savedRainState = loadFromStorage('rain_chart_collapsed');
if (savedRainState === true) {
    const wrapper = document.getElementById('rain-chart-wrapper');
    const icon = document.getElementById('rain-toggle-icon');
    if (wrapper) wrapper.style.display = 'none';
    if (wrapper) setChartCardCollapsedState(wrapper, true);
    if (icon) icon.style.transform = 'rotate(-90deg)';
}


// --- Favorites / Quick Switch UI ---
export function toggleLocationFavorite() {
    AppState.locManager.toggleFavorite();
    updateFavoriteStar();
}

export function toggleLocationDropdown(arg) {
    let trigger = (arg && arg.nodeType === 1) ? arg : (arg && arg.currentTarget ? arg.currentTarget : null);
    if (arg && arg.stopPropagation) arg.stopPropagation();
    const triggerWrapper = trigger ? trigger.closest('.location-group') : null;
    const triggerHeader = triggerWrapper ? triggerWrapper.closest('.header') : null;
    const setDropdownOpenState = (open) => {
        if (triggerWrapper) triggerWrapper.classList.toggle('location-group--dropdown-open', open);
        if (triggerHeader) triggerHeader.classList.toggle('header--dropdown-open', open);
    };

    let dropdown = document.getElementById('location-dropdown');
    if (trigger) {
        if (triggerWrapper) {
            const found = triggerWrapper.querySelector('.dropdown-menu');
            if (found) dropdown = found;
        }
    }

    if (!dropdown) return;

    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
        setDropdownOpenState(false);
        return;
    }

    // Ensure only one dropdown stacking context stays open.
    document.querySelectorAll('.location-group--dropdown-open')
        .forEach((el) => el.classList.remove('location-group--dropdown-open'));
    document.querySelectorAll('.header--dropdown-open')
        .forEach((el) => el.classList.remove('header--dropdown-open'));

    // Render & Show
    dropdown.innerHTML = '';

    // Favorites
    if (AppState.locManager.favorites.length > 0) {
        const hFav = document.createElement('div');
        hFav.className = 'dropdown-header';
        hFav.textContent = 'Favorites';
        dropdown.appendChild(hFav);

        AppState.locManager.favorites.forEach(fav => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            appendLocationLabel(item, fav.name, fav.country, 'sub');
            item.onclick = () => {
                AppState.locManager.setLocation(fav.lat, fav.lon, fav.name, fav.country);
                dropdown.style.display = 'none';
                setDropdownOpenState(false);
            };
            dropdown.appendChild(item);
        });

        const div = document.createElement('div');
        div.className = 'dropdown-divider';
        dropdown.appendChild(div);
    }

    // Recents
    const recentsToUse = AppState.locManager.recents.filter(r => !AppState.locManager.isFavorite(r)).slice(0, 5);
    if (recentsToUse.length > 0) {
        const hRec = document.createElement('div');
        hRec.className = 'dropdown-header';
        hRec.textContent = 'Recent';
        dropdown.appendChild(hRec);

        recentsToUse.forEach(rec => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            appendLocationLabel(item, rec.name, rec.country, 'sub');
            item.onclick = () => {
                AppState.locManager.setLocation(rec.lat, rec.lon, rec.name, rec.country);
                dropdown.style.display = 'none';
                setDropdownOpenState(false);
            };
            dropdown.appendChild(item);
        });

        const div = document.createElement('div');
        div.className = 'dropdown-divider';
        dropdown.appendChild(div);
    }

    // Search Option
    const searchItem = document.createElement('div');
    searchItem.className = 'dropdown-item dropdown-item-search';
    searchItem.innerHTML = `<span class="dropdown-search-label"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Search...</span>`;
    searchItem.onclick = () => {
        dropdown.style.display = 'none';
        setDropdownOpenState(false);
        openLocationModal();
    };
    dropdown.appendChild(searchItem);

    dropdown.style.display = 'block';
    setDropdownOpenState(true);

    // Click outside to close
    const closeMenu = (e) => {
        if (!dropdown.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
            dropdown.style.display = 'none';
            setDropdownOpenState(false);
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

export function updateFavoriteStar() {
    if (!AppState.locManager) return;
    const isFav = AppState.locManager.isFavorite();
    document.querySelectorAll('.btn-favorite').forEach(btn => {
        const svg = btn.querySelector('svg');
        if (isFav) {
            btn.classList.add('star-active');
            if (svg) { svg.style.fill = 'currentColor'; svg.style.stroke = 'currentColor'; }
            btn.style.opacity = '1';
        } else {
            btn.classList.remove('star-active');
            if (svg) { svg.style.fill = 'none'; svg.style.stroke = 'currentColor'; }
            btn.style.opacity = '0.5';
        }
    });
}

// FAB Click Listener
document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('fab-refresh');
    if (fab) {
        fab.addEventListener('click', async () => {
            if (AppState.refreshWeather) {
                fab.classList.add('fab-spin');
                await AppState.refreshWeather(true);
                setTimeout(() => fab.classList.remove('fab-spin'), 1000);
            }
        });
    }
});

export function toggleDarkMode() {
    AppStore.dispatch(StoreActions.patchUI({ isDark: !UIState.isDark }));
    if (UIState.isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    renderClimateHeatmap();
}

export function setForecastData(d) {
    AppStore.dispatch(StoreActions.setForecastData(d));
}
export function setClimateData(d) {
    AppStore.dispatch(StoreActions.setClimateData(d));
}


// --- VDOT Gauge ---
function getAgeGradeColor(score) {
    if (score >= 90) return '#7c3aed'; // Purple - World Class
    if (score >= 80) return '#3b82f6'; // Blue - National Class
    if (score >= 70) return '#22c55e'; // Green - Regional Class
    if (score >= 60) return '#f97316'; // Orange - Local Class
    return '#ef4444';                  // Red - Below
}

function getAgeGradeLabel(score) {
    if (score >= 100) return 'World Record';
    if (score >= 90) return 'World Class';
    if (score >= 80) return 'National Class';
    if (score >= 70) return 'Regional Class';
    if (score >= 60) return 'Local Class';
    return '';
}

export function updateVDOTGauge(vdot, ageGradeScore) {
    const arc = document.getElementById('vdot-gauge-arc');
    const label = document.getElementById('vdot-gauge-label');
    if (!arc) return;

    // Arc total length = π * r = π * 50 ≈ 157
    const ARC_LENGTH = 157;

    let fillPercent, color;

    if (ageGradeScore !== null && ageGradeScore !== undefined) {
        // Use age grade score (0-100) for arc fill and color
        fillPercent = Math.min(ageGradeScore / 100, 1);
        color = getAgeGradeColor(ageGradeScore);
        const gradeLabel = getAgeGradeLabel(ageGradeScore);

        if (label) {
            label.textContent = gradeLabel;
            label.style.color = color;
        }
    } else {
        // Fallback: use VDOT range (30-85) for arc fill
        const minVDOT = 30, maxVDOT = 85;
        fillPercent = Math.min(Math.max((vdot - minVDOT) / (maxVDOT - minVDOT), 0), 1);
        color = 'var(--accent-color)';

        if (label) {
            label.textContent = '';
        }
    }

    const offset = ARC_LENGTH * (1 - fillPercent);
    arc.style.strokeDashoffset = offset;
    arc.style.stroke = color;
    arc.style.filter = `drop-shadow(0 0 6px ${color})`;
}

// --- Helpers ---
// date/time format helpers
// formatTime imported from core.js


export function showInfoTooltip(e, title, text) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const preferSheet = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: none), (pointer: coarse)').matches;

    const contentKey = `${title || ''}__${text || ''}`;
    const el = document.getElementById('forecast-tooltip');
    // Toggle: if already showing this tooltip, hide it
    if (el && el.style.opacity === '1' && el.dataset.currentKey === contentKey) {
        hideForeTooltip();
        return;
    }

    const titleHtml = title ? `<div class="tooltip-header">${title}</div>` : '';
    const closeButton = preferSheet
        ? `<button type="button" class="tooltip-sheet-close" data-tooltip-close aria-label="Close tooltip">×</button>`
        : '';
    const html = `
                        ${closeButton}
                        ${titleHtml}
                        <div class="tooltip-content-body">${text}</div>
                    `;

    showForeTooltip(e, html, { preferSheet });
    const activeTooltip = document.getElementById('forecast-tooltip');
    if (!activeTooltip) return;
    if (!preferSheet) {
        const maxWidth = Math.min(360, window.innerWidth - 16);
        activeTooltip.style.maxWidth = `${maxWidth}px`;
    }
    activeTooltip.dataset.currentKey = contentKey;

    const closeBtn = activeTooltip.querySelector('[data-tooltip-close]');
    if (closeBtn && closeBtn.dataset.bound !== '1') {
        closeBtn.addEventListener('click', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            hideForeTooltip();
        });
        closeBtn.dataset.bound = '1';
    }

    if (preferSheet) return;

    const pointerX = Number.isFinite(e?.clientX) ? e.clientX : (window.innerWidth / 2);
    const pointerY = Number.isFinite(e?.clientY) ? e.clientY : (window.innerHeight / 2);
    const rect = activeTooltip.getBoundingClientRect();

    // Position
    let left = pointerX + 10;
    if ((left + rect.width) > (window.innerWidth - 8)) {
        left = window.innerWidth - rect.width - 8;
    }
    if (left < 8) left = 8;

    let top = pointerY + 12;
    if ((top + rect.height) > (window.innerHeight - 8)) {
        top = pointerY - rect.height - 12;
    }
    if (top < 8) top = 8;

    activeTooltip.style.left = left + 'px';
    activeTooltip.style.top = top + 'px';
}

export function toggleForeSelection(isoTime, e) {
    if (e) e.stopPropagation();
    let nextHour = null;
    if (isoTime !== null) {
        nextHour = (UIState.selectedForeHour === isoTime) ? null : isoTime;
    }
    AppStore.dispatch(StoreActions.patchUI({
        selectedForeHour: nextHour
    }));
    renderAllForecasts({ selection: true });
}

export function toggleVDOTDetails(e) {
    const el = document.getElementById('vdot-details');
    const card = document.getElementById('vdot-card');
    const trigger = document.querySelector('#vdot-card .vdot-header[data-action="vdot-details"]');
    if (!el) return;
    // If click originated from within the details panel, don't toggle
    if (e && e.target && el.contains(e.target)) return;
    const isHidden = getComputedStyle(el).display === 'none';
    if (isHidden) {
        el.style.display = 'block';
        if (card) card.classList.add('vdot-expanded');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        renderVDOTDetails();
    } else {
        el.style.display = 'none';
        if (card) card.classList.remove('vdot-expanded');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
}

// Altitude Impact Card Renderer
export function renderAltitudeCard() {
    const card = document.getElementById('altitude-impact-card');
    if (!card) return;

    const baseAlt = AppState.altitude.base || 0;
    const currentAlt = AppState.altitude.current || 0;
    const delta = currentAlt - baseAlt;
    const absDelta = Math.abs(delta);

    // Only show if at least 100m difference
    if (absDelta < 100) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'flex';
    card.classList.add('impact-status-card');

    const altitudeInfo = infoIcon(
        '',
        'Pace adjustment from altitude by &lt;a href=&quot;https://pubmed.ncbi.nlm.nih.gov/16311764/&quot; target=&quot;_blank&quot;&gt;Wehrlin &amp; Hallén (2006)&lt;/a&gt; for ascending, &lt;a href=&quot;https://pubmed.ncbi.nlm.nih.gov/9216951/&quot; target=&quot;_blank&quot;&gt;Levine &amp; Stray-Gundersen (1997)&lt;/a&gt; for descending.',
        'info-tooltip-trigger--card-corner'
    );

    import('./altitude.js').then(({ AltitudeCalc }) => {
        const isAscending = delta > 0;

        if (isAscending) {
            // Going UP - pace penalty
            const impact = AltitudeCalc.getAltitudeImpact(baseAlt, currentAlt);

            if (impact.impactPct > 0.5) {
                card.style.display = 'flex';
                card.innerHTML = `<div class="impact-status-copy">Altitude<br><span class="impact-note-value impact-note-value--headwind">~${impact.impactPct.toFixed(1)}% slowdown</span></div>${altitudeInfo}`;
            } else {
                card.style.display = 'none';
            }
        } else {
            // Going DOWN - pace boost
            const boost = AltitudeCalc.calculateDescentBoost(300, baseAlt, currentAlt); // Use ref pace

            if (boost.gainPercent > 0.5) {
                card.style.display = 'flex';
                card.innerHTML = `<div class="impact-status-copy">Altitude<br><span class="impact-note-value impact-note-value--tailwind">~${boost.gainPercent.toFixed(1)}% faster</span></div>${altitudeInfo}`;
            } else {
                card.style.display = 'none';
            }
        }
    });
}

export function handleChartHover(e, totalW, chartW, padLeft, dataLen) {
    const rect = e.target.getBoundingClientRect();
    // Adjust mouseX to be relative to the chart area (padLeft offset)
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const len = dataLen || UIState.forecastData.length;
    let idx = Math.round(ratio * (len - 1));
    idx = Math.max(0, Math.min(idx, len - 1)); // Clamp to bounds

    if (idx >= 0 && idx < UIState.forecastData.length) {
        const d = UIState.forecastData[idx];
        const date = new Date(d.time);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        const hourStr = d.time.substring(11, 13);

        const type = e.target.getAttribute('data-type'); // Check chart type

        let html = '';

        if (type === 'rain') {
            // Rain Tooltip
            html = `
                <div class="tooltip-header">${dayName} ${dateStr} ${hourStr}:00</div>
                <div class="tooltip-row"><span class="tooltip-label">Rain:</span> <span class="tooltip-val tooltip-val--rain">${d.rain != null ? d.rain.toFixed(1) : '0.0'} mm</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Prob:</span> <span class="tooltip-val tooltip-val--prob">${d.prob != null ? d.prob : '0'}%</span></div>
            `;
        } else if (type === 'wind') {
            // Wind Tooltip
            const getCardinal = (angle) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(angle / 45) % 8];
            const dirStr = getCardinal(d.dir || 0);
            html = `
                <div class="tooltip-header">${dayName} ${dateStr} ${hourStr}:00</div>
                <div class="tooltip-row"><span class="tooltip-label">Wind:</span> <span class="tooltip-val tooltip-val--wind">${d.wind != null ? d.wind.toFixed(1) : '0'} km/h</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Dir:</span> <span class="tooltip-val tooltip-val--dir">${dirStr}</span></div>
            `;
        } else {
            // Standard Temp/Impact Tooltip
            let baseSec = getBasePaceSec();
            const adjPace = AppState.hapCalc ? AppState.hapCalc.calculatePaceInHeat(baseSec, d.temp, d.dew) : baseSec;
            const pct = ((adjPace - baseSec) / baseSec) * 100;
            const color = getImpactColor(pct);

            html = `
                <div class="tooltip-header">${dayName} ${dateStr} ${hourStr}:00</div>
                <div class="tooltip-row"><span class="tooltip-label">Temp:</span> <span class="tooltip-val tooltip-val--temp">${d.temp != null ? d.temp.toFixed(1) : '--'}°</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Dew:</span> <span class="tooltip-val tooltip-val--dew">${d.dew != null ? d.dew.toFixed(1) : '--'}°</span></div>
                <div class="tooltip-row tooltip-row--divider">
                    <span class="tooltip-label">Impact:</span> <span class="tooltip-val tooltip-val--impact" style="--tooltip-impact-color:${color}">${pct.toFixed(2)}%</span>
                </div>
            `;
        }
        showForeTooltip(e, html);
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
        toggleForeSelection(d.time, e);
    }
}

export function showClimateTooltip(e, w, h, impact, temp, dew, count) {
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
                    <div class="tooltip-row"><span class="tooltip-label">Temp:</span> <span class="tooltip-val tooltip-val--temp">${(temp || 0).toFixed(1)}°</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Dew:</span> <span class="tooltip-val tooltip-val--dew">${(dew || 0).toFixed(1)}°</span></div>
                    <div class="tooltip-row tooltip-row--divider">
                        <span class="tooltip-label">Impact:</span> <span class="tooltip-val tooltip-val--impact" style="--tooltip-impact-color:${impactColor}">${(impact || 0).toFixed(2)}%</span>
                    </div>
                `;
    showForeTooltip(e, html);
    const tooltip = document.getElementById('forecast-tooltip');
    if (tooltip) tooltip.dataset.currentKey = '';
}

export function moveClimateTooltip(e) {
    moveForeTooltip(e);
}
export function hideClimateTooltip() {
    hideForeTooltip();
}
export function filterClimateByImpact(idx, el) {
    const nextFilter = UIState.climateImpactFilter === idx ? null : idx;
    AppStore.dispatch(StoreActions.patchUI({
        climateImpactFilter: nextFilter
    }));
    if (nextFilter === null) {
        // Clear dimming
        if (el && el.parentElement) el.parentElement.querySelectorAll('.legend-item').forEach(e => e.classList.remove('opacity-20'));
    } else {
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
    let nextCol = col;
    let nextDir = 'asc';
    if (UIState.climateSortCol === col) {
        nextDir = (UIState.climateSortDir === 'asc') ? 'desc' : 'asc';
    } else {
        nextDir = 'desc'; // Default high impact/temp first
        if (col === 'date' || col === 'hour') nextDir = 'asc';
    }
    AppStore.dispatch(StoreActions.patchUI({
        climateSortCol: nextCol,
        climateSortDir: nextDir
    }));
    renderClimateTable();
}

export function toggleClimateFilter(w, h, e) {
    if (e) e.stopPropagation(); // Essential to prevent document click from clearing selection immediately
    let nextKey = null;
    if (w === null) {
        nextKey = null;
    } else {
        const key = `${w}-${h}`;
        nextKey = (UIState.selectedClimateKey === key) ? null : key;
    }
    AppStore.dispatch(StoreActions.patchUI({
        selectedClimateKey: nextKey
    }));
    // Sync UIState
    renderClimateTable();
    renderClimateHeatmap(); // Update opacity
    renderClimateLegend(); // Update legend
}

export async function fetchIPLocation(originalError) {
    const btn = document.getElementById('gps-btn');
    const originalText = 'Use My Location'; // Hardcoded fallback for text
    if (btn) btn.innerHTML = 'Trying IP Location...';
    console.log("Attempting IP Fallback...");

    const request = beginRequest(RequestKeys.IP_LOCATION, { abortPrevious: true });
    try {
        const data = await fetchIpLocation({ signal: request.signal });
        if (!isRequestCurrent(RequestKeys.IP_LOCATION, request.seq)) return;
        if (!data) throw new Error("IP Location failed");
        console.log("IP Location Success:", data);
        AppState.locManager.setLocation(data.lat, data.lon, data.name, data.country);
        endRequest(RequestKeys.IP_LOCATION, request.seq, 'success');
        if (btn) btn.innerHTML = originalText;
    } catch (e) {
        if (e && e.name === 'AbortError') {
            endRequest(RequestKeys.IP_LOCATION, request.seq, 'aborted');
            return;
        }
        endRequest(RequestKeys.IP_LOCATION, request.seq, 'error', e && e.message ? e.message : 'IP location failed');
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
        if (locationSearchDebounceTimer) {
            clearTimeout(locationSearchDebounceTimer);
            locationSearchDebounceTimer = null;
        }
        cancelRequest(RequestKeys.LOCATION_SEARCH, 'modal reopened');
        locationSearchSeq++;
        // Render Recents if available and search is empty
        var list = document.getElementById('loc-results');
        var searchIn = document.getElementById('loc-search');
        const renderRecents = () => {
            if (!list) return;
            list.innerHTML = '';
            if (AppState.locManager && AppState.locManager.recents && AppState.locManager.recents.length > 0) {
                var header = document.createElement('div');
                header.className = 'loc-section-header';
                header.textContent = "Recent Locations";
                list.appendChild(header);
                AppState.locManager.recents.forEach(function (item) {
                    var div = document.createElement('div');
                    div.className = 'loc-item';
                    var country = item.country || '';
                    appendLocationLabel(div, item.name, country, 'loc-sub');
                    div.onclick = function () { AppState.locManager.setLocation(item.lat, item.lon, item.name, country); };
                    list.appendChild(div);
                });
            }
        };

        const renderSearchResults = (results) => {
            if (!list) return;
            list.innerHTML = '';
            if (results && results.length > 0) {
                results.forEach(item => {
                    var div = document.createElement('div');
                    div.className = 'loc-item';
                    var state = item.admin1 || '';
                    var country = item.country || '';
                    var subText = [state, country].filter(Boolean).join(', ');
                    appendLocationLabel(div, item.name, subText, 'loc-sub');
                    div.onclick = function () { AppState.locManager.setLocation(item.latitude, item.longitude, item.name, country); };
                    list.appendChild(div);
                });
            }
        };

        if (list && searchIn) {
            searchIn.value = ''; // Clear search
            renderRecents();
        }
        setTimeout(function () {
            var i = document.getElementById('loc-search');
            if (i) {
                i.focus();
                // Attach Search Listener if not already attached (or just overwrite oninput)
                i.oninput = async (e) => {
                    const q = (e.target.value || '').trim();
                    const requestId = ++locationSearchSeq;
                    if (locationSearchDebounceTimer) clearTimeout(locationSearchDebounceTimer);

                    if (q.length < 3) {
                        cancelRequest(RequestKeys.LOCATION_SEARCH, 'query too short');
                        renderRecents();
                        return;
                    }

                    locationSearchDebounceTimer = setTimeout(async () => {
                        const req = beginRequest(RequestKeys.LOCATION_SEARCH, {
                            abortPrevious: true,
                            meta: { query: q }
                        });
                        try {
                            const res = await AppState.locManager.searchCity(q, { signal: req.signal });
                            if (requestId !== locationSearchSeq || !isRequestCurrent(RequestKeys.LOCATION_SEARCH, req.seq)) return;
                            renderSearchResults(res);
                            endRequest(RequestKeys.LOCATION_SEARCH, req.seq, 'success');
                        } catch (err) {
                            if (err && err.name === 'AbortError') {
                                endRequest(RequestKeys.LOCATION_SEARCH, req.seq, 'aborted');
                                return;
                            }
                            if (requestId !== locationSearchSeq) return;
                            endRequest(
                                RequestKeys.LOCATION_SEARCH,
                                req.seq,
                                'error',
                                err && err.message ? err.message : 'Location search failed'
                            );
                            console.error("Location search failed", err);
                            if (list) list.innerHTML = '';
                        }
                    }, 220);
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
        if (UIState.selectedForeHour) {
            // Updated IDs for 16-day forecast
            const charContainer = document.getElementById('forecast-chart-container-16');
            const rainChart = document.getElementById('forecast-rain-chart-container-16');
            const windChart = document.getElementById('forecast-wind-chart-container-16');
            const legend = document.getElementById('legend-container-16');

            const isOutsideChart = !charContainer || !charContainer.contains(e.target);
            const isOutsideRain = !rainChart || !rainChart.contains(e.target);
            const isOutsideWind = !windChart || !windChart.contains(e.target);
            const isOutsideLegend = !legend || !legend.contains(e.target);


            // Should also ignore clicks on the "Best Run" buttons (but NOT the banner itself, per user request)
            const isOutsideBestButtons = !e.target.closest('.insight-btn');

            // Also check if target is the interaction layer (though inside chart) or specific buttons
            console.log('Click check Forecast:', { isOutsideChart, isOutsideRain, isOutsideWind, isOutsideLegend, isOutsideBestButtons, target: e.target });

            if (isOutsideChart && isOutsideRain && isOutsideWind && isOutsideLegend && isOutsideBestButtons) {
                console.log("Deselecting Forecast");
                toggleForeSelection(null);
            }
        }

        // Climate Deselection
        if (UIState.selectedClimateKey) {
            const cmap = document.getElementById('climate-heatmap-container');
            const cleg = document.getElementById('climate-legend-container'); // Check if this ID is correct in renderers
            if ((!cmap || !cmap.contains(e.target)) && (!cleg || !cleg.contains(e.target))) {
                toggleClimateFilter(null, null);
            }
        }

        // Forecast Impact Filter Deselection (click outside legend/filter)
        if (UIState.selectedImpactFilter) {
            const fLegend = document.getElementById('legend-container-16');
            const clickedForecastFilter = e.target.closest('[data-action="filter-impact"]');
            const clickedInsideForecastLegend = fLegend && fLegend.contains(e.target);
            if (!clickedForecastFilter && !clickedInsideForecastLegend) {
                AppStore.dispatch(StoreActions.patchUI({
                    selectedImpactFilter: null
                }));
                renderAllForecasts({ filter: true });
            }
        }

        // Climate Impact Filter Deselection (click outside legend/filter)
        if (UIState.climateImpactFilter !== null) {
            const cLegend = document.getElementById('climate-legend-container');
            const clickedClimateFilter = e.target.closest('[data-action="filter-climate-impact"]');
            const clickedInsideClimateLegend = cLegend && cLegend.contains(e.target);
            if (!clickedClimateFilter && !clickedInsideClimateLegend) {
                AppStore.dispatch(StoreActions.patchUI({
                    climateImpactFilter: null
                }));
                renderClimateHeatmap();
                renderClimateTable();
                renderClimateLegend();
            }
        }

        // Info Tooltip Dismiss (click outside)
        const tooltip = document.getElementById('forecast-tooltip');
        if (tooltip && tooltip.style.opacity === '1') {
            if (e.__keepTooltipOpen) return;
            // Check if click is on an info icon (has showInfoTooltip onclick)
            const isInfoIcon = e.target.closest('[data-action="info-tooltip"]');
            const isClimateCell = e.target.closest('[data-action="climate-cell"]');
            const isForecastHeatCell = e.target.closest('[data-action="select-forecast"]');
            const isForecastChartLayer = e.target.closest('[data-action="chart-interact"]');
            if (!isInfoIcon && !isClimateCell && !isForecastHeatCell && !isForecastChartLayer && !tooltip.contains(e.target)) {
                hideForeTooltip();
            }
        }
    });

    // Responsive Chart Resizing
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            renderAllForecasts({ layout: true });
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
        runnerWeight: AppState.runner.weight || 65,
        age: parseInt(els.age ? els.age.value : 0),
        gender: els.gender ? els.gender.value : '',
        baseAltitude: AppState.altitude.base || 0,
        currentElevation: AppState.altitude.current || 0
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
    if (els.vdot) {
        // Animate VDOT
        const current = parseFloat(els.vdot.textContent) || 0;
        animateValue('vdot-val', current, res.vdot, 800);
    }
    const elThreshold = document.getElementById('vdot-threshold');
    if (elThreshold) {
        elThreshold.textContent = `${formatTime(res.paces.threshold)}/km`;
    }

    // Update VDOT Gauge with Age Grade
    const age = AppState.runner.age;
    const gender = AppState.runner.gender;
    let ageGradeScore = null;
    if (age && gender) {
        const agRes = calculateAgeGrade(state.distance, state.timeSec, age, gender);
        if (agRes) ageGradeScore = agRes.score;
    }
    updateVDOTGauge(res.vdot, ageGradeScore);

    // Live Update of VDOT Details if Open
    const vdotDetails = document.getElementById('vdot-details');
    if (vdotDetails && vdotDetails.style.display !== 'none') {
        renderVDOTDetails();
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
        const view = AppState.paceView || { heat: false, headwind: false, tailwind: false };

        // 2. Heat Adjusted (if valid AND toggled)
        if (view.heat && res.weather.valid && res.weather.adjustedPaces[key]) {
            const adj = res.weather.adjustedPaces[key];
            // Show only if meaningful difference (> 0.5s)
            if (adj > 0 && Math.abs(adj - pace) > 0.5) {
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

        // 4. Altitude Adjusted (if valid AND toggled)
        if (view.altitude && res.altitude && res.altitude.valid && res.altitude.adjustedPaces[key]) {
            const altAdj = res.altitude.adjustedPaces[key];
            const isGain = altAdj < pace; // Faster pace = gain (descending)
            // Show only if meaningful difference (> 0.5s)
            if (altAdj > 0 && Math.abs(altAdj - pace) > 0.5) {
                cols.push({
                    label: isGain ? "Alt ↓" : "Alt ↑",
                    paceSec: altAdj,
                    color: isGain ? "#4ade80" : "#a78bfa" // Green for gain, Purple for penalty
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
    renderRow('p1min', els.pace1, els.dist1, 60);
    renderRow('easy', els.paceEasy, null, 0);

    // Impact Text - Heat
    if (res.weather.valid) {
        if (els.weatherImpact) {
            const heatInfoIcon = infoIcon(
                '',
                'Pace adjustment from Hot-weather pace calculator by &lt;a href=&quot;https://apps.runningwritings.com/heat-adjusted-pace/&quot; target=&quot;_blank&quot;&gt;John Davis&lt;/a&gt;.',
                'info-tooltip-trigger--card-corner'
            );
            els.weatherImpact.innerHTML = `Heat Impact: <span class="impact-note-value" style="--impact-note-color:${impactColor}">~${res.weather.impactPct.toFixed(1)}% slowdown</span>${heatInfoIcon}`;
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
                html += `<div class="impact-note-line impact-note-line--spaced">Headwind<br><span class="impact-note-value impact-note-value--headwind">~${headwindPct.toFixed(1)}% slowdown</span></div>`;
            }

            // Tailwind (Increase/Speedup)
            if (Math.abs(tailwindPct) > 0.1) {
                const val = Math.abs(tailwindPct);
                html += `<div class="impact-note-line">Tailwind<br><span class="impact-note-value impact-note-value--tailwind">~${val.toFixed(1)}% faster</span></div>`;
            }
            if (!html) html = "Wind Impact: Negligible";
            const windInfoIcon = infoIcon(
                '',
                'Pace adjustment from Headwind and tailwind calculator by &lt;a href=&quot;https://apps.runningwritings.com/wind-calculator&quot; target=&quot;_blank&quot;&gt;John Davis&lt;/a&gt;.',
                'info-tooltip-trigger--card-corner'
            );

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
        showToast("Results copied!");
    }).catch(err => console.error("Failed to copy", err));
}
export function useGPS() {
    if (!navigator.geolocation) {
        fetchIPLocation({ message: "Geolocation not supported" });
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
        const request = beginRequest(RequestKeys.REVERSE_GEOCODE, {
            abortPrevious: true,
            meta: { lat, lon }
        });
        try {
            const city = await reverseGeocode(lat, lon, { signal: request.signal });
            if (!isRequestCurrent(RequestKeys.REVERSE_GEOCODE, request.seq)) return;
            const name = city ? city.name : "My Location";
            const country = city ? city.country : "";
            if (AppState.locManager) AppState.locManager.setLocation(lat, lon, name, country);
            endRequest(RequestKeys.REVERSE_GEOCODE, request.seq, 'success');
        } catch (e) {
            if (e && e.name === 'AbortError') {
                endRequest(RequestKeys.REVERSE_GEOCODE, request.seq, 'aborted');
                return;
            }
            endRequest(
                RequestKeys.REVERSE_GEOCODE,
                request.seq,
                'error',
                e && e.message ? e.message : 'Reverse geocode failed'
            );
            console.error("GPS Reverse Geocode Error", e);
            if (AppState.locManager) AppState.locManager.setLocation(lat, lon, "My Location", "");
        }
        if (btn) btn.innerHTML = originalText;
    }, (err) => {
        console.warn("Native GPS Error:", err);
        // Fallback to IP location if GPS fails (e.g., kCLErrorLocationUnknown)
        fetchIPLocation(err);
    }, options);
}

// Block-level loading skeletons (non-blocking for whole app)
const loadTimers = {};

const blockLoadingTargets = {
    current: [
        {
            resolve: () => document.getElementById('current-content'),
            classes: ['block-skeleton', 'block-skeleton-grid']
        }
    ],
    forecast: [
        {
            resolve: () => document.getElementById('forecast-grid-container-16'),
            classes: ['block-skeleton', 'block-skeleton-heatmap']
        },
        {
            resolve: () => document.getElementById('forecast-chart-container-16'),
            classes: ['block-skeleton', 'block-skeleton-chart']
        },
        {
            resolve: () => document.getElementById('forecast-rain-chart-container-16'),
            classes: ['block-skeleton', 'block-skeleton-chart']
        },
        {
            resolve: () => document.getElementById('forecast-wind-chart-container-16'),
            classes: ['block-skeleton', 'block-skeleton-chart']
        },
        {
            resolve: () => document.getElementById('forecast-body-16')?.closest('.table-wrapper'),
            classes: ['block-skeleton', 'block-skeleton-table']
        }
    ],
    climate: [
        {
            resolve: () => document.getElementById('climate-heatmap-container'),
            classes: ['block-skeleton', 'block-skeleton-heatmap']
        },
        {
            resolve: () => document.getElementById('monthly-averages-content'),
            classes: ['block-skeleton', 'block-skeleton-list']
        },
        {
            resolve: () => document.getElementById('climateTableBody')?.closest('.table-wrapper'),
            classes: ['block-skeleton', 'block-skeleton-table']
        }
    ]
};

function applyBlockLoading(type, visible) {
    const targets = blockLoadingTargets[type] || [];
    targets.forEach((target) => {
        const el = target.resolve();
        if (!el) return;
        target.classes.forEach((cls) => {
            if (visible) el.classList.add(cls);
            else el.classList.remove(cls);
        });
    });
}

export function setLoading(type, visible) {
    if (visible) {
        // Debounce to avoid flicker on fast responses.
        if (loadTimers[type]) clearTimeout(loadTimers[type]);
        loadTimers[type] = setTimeout(() => {
            applyBlockLoading(type, true);
        }, 220);
        return;
    }

    // Cancel pending show and clear immediately.
    if (loadTimers[type]) {
        clearTimeout(loadTimers[type]);
        loadTimers[type] = null;
    }
    applyBlockLoading(type, false);
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
                AppStore.dispatch(StoreActions.patchUI({
                    isBatchLoading: true
                }));
                renderForecastTable('forecast-body-16', 14, true);
                setTimeout(() => {
                    AppStore.dispatch(StoreActions.patchUI({
                        isBatchLoading: false
                    }));
                }, 200);
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
                AppStore.dispatch(StoreActions.patchUI({
                    isBatchLoading: true
                }));
                renderClimateTable(true);
                setTimeout(() => {
                    AppStore.dispatch(StoreActions.patchUI({
                        isBatchLoading: false
                    }));
                }, 200);
            }
        });
    }

    AppStore.dispatch(StoreActions.patchUI({
        isScrollListenersSetup: true
    }));
    console.log("Virtual Scroll Ready");

    // Init Effects
    initRipple();
}


// --- Bottom Navigation ---
export function initBottomNav() {
    const navBar = document.querySelector('.bottom-nav');
    if (!navBar) return;

    const isBottomNavDisabled = document.body.classList.contains('bottom-nav-disabled')
        || navBar.dataset.enabled === 'false';
    if (isBottomNavDisabled) {
        navBar.classList.add('nav-hidden');
        navBar.setAttribute('aria-hidden', 'true');
        return;
    }

    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.main-view');

    // Pure Hover-to-Show (Desktop Dock Style)
    // Initially hidden
    navBar.classList.add('nav-hidden');

    window.addEventListener('mousemove', (e) => {
        const threshold = 100; // px from bottom
        const isNearBottom = (window.innerHeight - e.clientY) < threshold;

        if (isNearBottom) {
            navBar.classList.remove('nav-hidden');
        } else {
            navBar.classList.add('nav-hidden');
        }
    });

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 1. Toggle Active Button
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 2. Get Target View
            const targetId = btn.dataset.target;
            const targetView = document.getElementById(targetId);

            // 3. Switch Views
            views.forEach(v => {
                v.classList.add('hidden');
                // Ensure we override the inline style="display:none" if present
                v.style.display = 'none';
            });

            if (targetView) {
                targetView.classList.remove('hidden');
                // Reset inline display to allow CSS to take over (flex/block)
                targetView.style.display = '';

                // FIX: Ensure tabs in view-weather don't get stuck in active state
                if (targetId === 'view-weather') {
                    // Restore active state from UIState using centralized utility
                    const activeTabName = UIState.activeWeatherTab || 'calculator';

                    // Force update immediately
                    updateWeatherTabState(targetView, activeTabName);

                    // Safety: Force again next frame in case of weird transitions ??
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            updateWeatherTabState(targetView, activeTabName);
                        });
                    });

                    // Special logic for Climate/FAB visibility
                    const fab = document.getElementById('fab-refresh');
                    if (fab) {
                        if (activeTabName === 'current') fab.classList.add('visible');
                        else fab.classList.remove('visible');
                    }
                }

                // 4. Lazy Load Library
                if (targetId === 'view-library') {
                    const iframe = document.getElementById('library-frame');
                    if (iframe && !iframe.src) {
                        iframe.src = 'http://localhost:5173';
                    }
                }
            }
        });
    });
}
