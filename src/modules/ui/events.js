import { UIState } from './state.js';
import { renderAllForecasts, renderClimateHeatmap, renderClimateTable, renderClimateLegend, calculateBestRunTime } from './renderers.js';
import { formatTime } from '../core.js';
import { getCondColor, showToast } from './utils.js'; // used in handleCellHover maybe?

// Some events might use window.hapCalc?
// ui.js had it globally available or via module scope if defined.
// events.js will access window.hapCalc if needed.

export function copyConditions() {
    if (!UIState.currentWeatherData) return;
    const w = UIState.currentWeatherData;

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

    const text = `Run Conditions ${time} | Temp: ${temp.toFixed(1)}°C (Feels ${feels.toFixed(1)}°C) | Dew Point: ${dew.toFixed(1)}°C | Humidity: ${hum}% | Wind: ${wind.toFixed(1)} km/h ${dirStr} | Rain (2h): ${rain.toFixed(1)} mm`;

    navigator.clipboard.writeText(text).then(() => {
        showToast("Conditions copied!");
        // Optional button feedback
    }).catch(err => console.error('Failed to copy', err));
}

export function hideForeTooltip() {
    const el = document.getElementById('forecast-tooltip');
    if (el) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none'; // Prevent blocking clicks
    }
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
    el.style.pointerEvents = 'auto'; // Re-enable clicks inside tooltip

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

export function sortForecastTable(col) {
    if (UIState.forecastSortCol === col) {
        UIState.forecastSortDir = UIState.forecastSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        UIState.forecastSortCol = col;
        UIState.forecastSortDir = 'asc';
    }
    renderAllForecasts();
}

export function toggleImpactFilter(cat) {
    if (UIState.selectedImpactFilter === cat) UIState.selectedImpactFilter = null;
    else UIState.selectedImpactFilter = cat;
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
    calculateBestRunTime(UIState.forecastData);
}

export function toggleForeSort(col) {
    if (UIState.forecastSortCol === col) {
        UIState.forecastSortDir = (UIState.forecastSortDir === 'asc') ? 'desc' : 'asc';
    } else {
        UIState.forecastSortCol = col;
        UIState.forecastSortDir = 'desc'; // Default to high-to-low for most metrics (Temp, Impact, etc) make sense? 
        // Actually:
        // Time: asc default
        // Temp: desc (hotter first)
        // Impact: desc (worse first)
        // Wind: desc (stronger first)
        // But standard table UX usually defaults asc. Let's stick to standard toggle or smart default.
        // Let's standard toggle: if new col, default asc. 
        // User can click again.
        UIState.forecastSortDir = 'asc';
        if (['impact', 'temp', 'dew', 'wind', 'rain', 'prob'].includes(col)) UIState.forecastSortDir = 'desc';
    }
    renderAllForecasts();
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

export function openTab(tabName, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const tabEl = document.getElementById('tab-' + tabName);
    if (tabEl) tabEl.classList.add('active');

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

export function toggleForeSelection(time, event) {
    if (UIState.selectedForeHour === time) {
        UIState.selectedForeHour = null;
    } else {
        UIState.selectedForeHour = time;
    }
    renderAllForecasts();
}
