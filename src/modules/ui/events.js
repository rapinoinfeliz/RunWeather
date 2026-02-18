import { UIState } from './state.js';
import { renderAllForecasts, renderClimateHeatmap, renderClimateTable, renderClimateLegend, calculateBestRunTime } from './renderers.js';
import { showToast } from './utils.js';
import { AppStore, StoreActions } from '../store.js';
import {
    formatDisplayPrecip,
    formatDisplayTemperature,
    formatDisplayWind,
    getUnitSystem,
    precipitationUnit,
    temperatureUnit,
    windUnit
} from '../units.js';

function patchUI(patch) {
    AppStore.dispatch(StoreActions.patchUI(patch));
}

function shouldUseTooltipSheet(preferSheet = false) {
    if (preferSheet) return true;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

function ensureTooltipBackdrop() {
    let backdrop = document.getElementById('forecast-tooltip-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'forecast-tooltip-backdrop';
        backdrop.className = 'forecast-tooltip-backdrop';
        document.body.appendChild(backdrop);
    }
    if (document.body.dataset.tooltipEscBound !== '1') {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideForeTooltip();
        });
        document.body.dataset.tooltipEscBound = '1';
    }
    if (backdrop.dataset.bound !== '1') {
        backdrop.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideForeTooltip();
        });
        backdrop.dataset.bound = '1';
    }
    return backdrop;
}

export function copyConditions() {
    if (!UIState.currentWeatherData) return;
    const w = UIState.currentWeatherData;
    const system = getUnitSystem();
    const tempUnitLabel = temperatureUnit(system);
    const windUnitLabel = windUnit(system);
    const precipUnitLabel = precipitationUnit(system);

    // Format: "Florianópolis 08:00 | 24°C (Feels 26) | Dew 20°C | Wind 15kph SE | Rain 0mm"
    const temp = w.temperature_2m;
    const feels = w.apparent_temperature;
    const dew = w.dew_point_2m;
    const wind = w.wind_speed_10m;
    const windDir = w.wind_direction_10m;

    const getCardinal = (angle) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(angle / 45) % 8];
    const dirStr = getCardinal(windDir);
    const rain = w.precipitation || 0;
    const hum = w.relative_humidity_2m;

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const text = `Run Conditions ${time} | Temp: ${formatDisplayTemperature(temp, 1, system)}${tempUnitLabel} (Feels ${formatDisplayTemperature(feels, 1, system)}${tempUnitLabel}) | Dew Point: ${formatDisplayTemperature(dew, 1, system)}${tempUnitLabel} | Humidity: ${hum}% | Wind: ${formatDisplayWind(wind, 1, system)} ${windUnitLabel} ${dirStr} | Rain (2h): ${formatDisplayPrecip(rain, 1, 2, system)} ${precipUnitLabel}`;

    navigator.clipboard.writeText(text).then(() => {
        showToast("Conditions copied!");
        // Optional button feedback
    }).catch(err => console.error('Failed to copy', err));
}

export function hideForeTooltip() {
    const el = document.getElementById('forecast-tooltip');
    if (el) {
        el.style.opacity = '0';
        el.style.display = 'none';
        el.style.pointerEvents = 'none'; // Prevent blocking clicks
        el.classList.remove('forecast-tooltip--sheet');
        el.dataset.mode = '';
        el.dataset.currentKey = '';
        el.setAttribute('aria-hidden', 'true');
    }
    const backdrop = document.getElementById('forecast-tooltip-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        backdrop.style.display = 'none';
    }
}

export function moveForeTooltip(e) {
    const el = document.getElementById('forecast-tooltip');
    if (el && el.dataset.mode !== 'sheet' && e && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
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

export function showForeTooltip(e, htmlContent, options = {}) {
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
    el.style.pointerEvents = 'auto'; // Re-enable clicks inside tooltip
    el.setAttribute('aria-hidden', 'false');

    const useSheet = shouldUseTooltipSheet(Boolean(options.preferSheet));
    const backdrop = ensureTooltipBackdrop();
    if (useSheet) {
        el.dataset.mode = 'sheet';
        el.classList.add('forecast-tooltip--sheet');
        el.style.left = '12px';
        el.style.right = '12px';
        el.style.top = 'auto';
        el.style.bottom = 'max(12px, calc(env(safe-area-inset-bottom) + 8px))';
        el.style.width = 'auto';
        el.style.maxWidth = 'none';
        backdrop.style.display = 'block';
        backdrop.classList.add('active');
        return;
    }

    el.dataset.mode = 'float';
    el.classList.remove('forecast-tooltip--sheet');
    el.style.right = '';
    el.style.bottom = '';
    backdrop.classList.remove('active');
    backdrop.style.display = 'none';

    // Initial Position
    const anchor = e && e.target && typeof e.target.closest === 'function'
        ? e.target.closest('[data-action]')
        : null;
    const anchorRect = anchor ? anchor.getBoundingClientRect() : null;
    const hasPoint = Number.isFinite(e?.clientX) && Number.isFinite(e?.clientY) && !(e.clientX === 0 && e.clientY === 0);
    const refX = hasPoint ? e.clientX : (anchorRect ? anchorRect.left + (anchorRect.width / 2) : window.innerWidth / 2);
    const refY = hasPoint ? e.clientY : (anchorRect ? anchorRect.top + (anchorRect.height / 2) : window.innerHeight / 2);
    const w = el.offsetWidth;
    let x = refX + 15;
    // Flip if overflow right
    if (x + w > window.innerWidth - 10) {
        x = refX - w - 15;
    }
    const y = refY - el.offsetHeight - 10;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

export function handleCellHover(e, el) {
    const day = el.getAttribute('data-day');
    const hour = el.getAttribute('data-hour');
    const tempRaw = parseFloat(el.getAttribute('data-temp'));
    const dewRaw = parseFloat(el.getAttribute('data-dew'));
    const pct = el.getAttribute('data-pct');
    const color = el.getAttribute('data-color');
    const system = getUnitSystem();
    const tempUnitLabel = temperatureUnit(system);

    const html = `
                        <div class="tooltip-header">${day} ${hour}:00</div>
                        <div class="tooltip-row"><span class="tooltip-label">Temp:</span> <span class="tooltip-val tooltip-val--temp">${formatDisplayTemperature(tempRaw, 1, system)} ${tempUnitLabel}</span></div>
                        <div class="tooltip-row"><span class="tooltip-label">Dew:</span> <span class="tooltip-val tooltip-val--dew">${formatDisplayTemperature(dewRaw, 1, system)} ${tempUnitLabel}</span></div>
                        <div class="tooltip-row tooltip-row--divider">
                            <span class="tooltip-label">Impact:</span> <span class="tooltip-val tooltip-val--impact" style="--tooltip-impact-color:${color}">${pct}%</span>
                        </div>
                    `;
    showForeTooltip(e, html);
}

export function sortForecastTable(col) {
    let nextSortCol = col;
    let nextSortDir = 'asc';
    if (UIState.forecastSortCol === col) {
        nextSortDir = UIState.forecastSortDir === 'asc' ? 'desc' : 'asc';
    }
    patchUI({
        forecastSortCol: nextSortCol,
        forecastSortDir: nextSortDir
    });
    renderAllForecasts({ sort: true });
}

export function toggleImpactFilter(cat) {
    patchUI({
        selectedImpactFilter: UIState.selectedImpactFilter === cat ? null : cat
    });
    renderAllForecasts({ filter: true });
}

export function setBestRunRange(range, event) {
    if (event) event.stopPropagation();
    patchUI({ selectedBestRunRange: range });

    // Update UI
    const btns = document.querySelectorAll('.insight-btn');
    btns.forEach(btn => {
        if (btn.innerText.toLowerCase() === range.toLowerCase()) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Recalculate
    // Recalculate
    const bestTime = calculateBestRunTime(UIState.forecastData);
    if (bestTime) {
        patchUI({ selectedForeHour: bestTime });
        renderAllForecasts({ range: true, selection: true });
        return;
    }
    renderAllForecasts({ range: true });
}

export function toggleForeSort(col) {
    let nextSortCol = col;
    let nextSortDir = 'asc';
    if (UIState.forecastSortCol === col) {
        nextSortDir = (UIState.forecastSortDir === 'asc') ? 'desc' : 'asc';
    } else {
        nextSortDir = 'desc'; // Default to high-to-low for most metrics (Temp, Impact, etc) make sense? 
        // Actually:
        // Time: asc default
        // Temp: desc (hotter first)
        // Impact: desc (worse first)
        // Wind: desc (stronger first)
        // But standard table UX usually defaults asc. Let's stick to standard toggle or smart default.
        // Let's standard toggle: if new col, default asc. 
        // User can click again.
        nextSortDir = 'asc';
        if (['impact', 'temp', 'dew', 'wind', 'rain', 'prob'].includes(col)) nextSortDir = 'desc';
    }
    patchUI({
        forecastSortCol: nextSortCol,
        forecastSortDir: nextSortDir
    });
    renderAllForecasts({ sort: true });
}

export function setPaceMode(mode) {
    patchUI({ currentPaceMode: mode });
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
    renderAllForecasts({ paceMode: true });
}

import { updateWeatherTabState } from './utils.js';

export function openTab(tabName, btn) {
    // Save State
    patchUI({ activeWeatherTab: tabName });

    // Use centralized update logic
    const view = document.getElementById('view-weather');
    updateWeatherTabState(view, tabName);

    // FAB Visibility
    const fab = document.getElementById('fab-refresh');
    if (fab) {
        if (tabName === 'current') {
            fab.classList.add('visible');
        } else {
            fab.classList.remove('visible');
        }
    }

    // Hide tooltip if exists
    const tooltip = document.getElementById('forecast-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.display = 'none'; // Force hide
    }
    hideForeTooltip();

    // Trigger Chart Render if Forecast/Climate Tab
    if (tabName === 'climate') {
        setTimeout(renderClimateHeatmap, 50);
    }
    if (tabName === 'forecast' || tabName === 'forecast16') {
        setTimeout(() => renderAllForecasts({ layout: true }), 100);
    }
}

export function toggleForeSelection(time, event) {
    patchUI({
        selectedForeHour: UIState.selectedForeHour === time ? null : time
    });
    renderAllForecasts({ selection: true });
}
