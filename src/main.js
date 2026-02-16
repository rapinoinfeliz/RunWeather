// Main Entry Point
import { HAPCalculator, parseTime, formatTime } from './modules/core.js';
import { LocationManager } from './modules/managers.js';
import { fetchWeatherData } from './modules/api.js';
import { HAP_GRID } from '../data/hap_grid.js';
import { AppState } from './modules/appState.js';

import * as UI from './modules/ui.js';
import { loadFromStorage, saveToStorage } from './modules/storage.js';
import { formatTimeInput, handleTimeInput, setupFineTuning, saveCalcState } from './modules/inputs.js';
import { initSettings, loadSavedSettings } from './modules/settings.js';

console.log("Main JS Starting... v1.0.17");

// --- Initialization ---
async function init() {
    console.log("Initializing App...");

    // 1. Core Logic
    if (HAP_GRID) {
        AppState.hapCalc = new HAPCalculator(HAP_GRID);
    } else {
        console.error("HAP_GRID failed to load");
    }

    // 2. Managers
    AppState.locManager = new LocationManager(async (loc) => {
        // On Location Change
        document.querySelectorAll('.current-location-name').forEach(el => {
            el.textContent = loc.name;
        });
        UI.closeLocationModal();

        UI.update(AppState.els, AppState.hapCalc);

        UI.setLoading('current', true);
        UI.setLoading('forecast', true);

        refreshWeather(true)
            .catch(console.error)
            .finally(() => {
                UI.setLoading('current', false);
                UI.setLoading('forecast', false);
            });

        if (AppState.climateManager) {
            UI.setLoading('climate', true);
            AppState.climateManager.loadDataForCurrentLocation()
                .catch(console.error)
                .finally(() => UI.setLoading('climate', false));
        }

        UI.updateFavoriteStar();
    });

    // Set initial location button text from saved state
    document.querySelectorAll('.current-location-name').forEach(el => {
        el.textContent = AppState.locManager.current.name;
    });
    UI.updateFavoriteStar();

    // 3. UI Setup
    const els = {
        distance: document.getElementById('distance'),
        preset: document.getElementById('dist-preset'),
        time: document.getElementById('time'),
        temp: document.getElementById('temp'),
        dew: document.getElementById('dew'),
        wind: document.getElementById('wind'), // New
        btnSettings: document.getElementById('btn-settings'), // New
        inputPace: document.getElementById('input-pace'),
        pred5k: document.getElementById('pred-5k'),
        vdot: document.getElementById('vdot-val'),
        // Age Grading Inputs
        age: document.getElementById('runner-age'),
        gender: document.getElementById('runner-gender'),
        pace10: document.getElementById('pace-10min'),
        dist10: document.getElementById('dist-10min'),
        pace6: document.getElementById('pace-6min'),
        dist6: document.getElementById('dist-6min'),
        pace3: document.getElementById('pace-3min'),
        dist3: document.getElementById('dist-3min'),
        pace1: document.getElementById('pace-1min'),
        dist1: document.getElementById('dist-1min'),
        paceEasy: document.getElementById('pace-easy'),
        weatherImpact: document.getElementById('weather-impact'),
        windImpact: document.getElementById('wind-impact') // New
    };
    AppState.els = els;

    // Attach global click helpers (deselection, resize)
    UI.setupWindowHelpers();
    UI.initBottomNav();

    // Auto-format time inputs on blur
    formatTimeInput(els.time);
    formatTimeInput(els.inputPace);

    // Impact Card Toggle Logic
    const updateImpactCards = () => {
        const heatCard = document.querySelector('[data-toggle-target="heat"]');
        const windCard = document.querySelector('[data-toggle-target="wind"]');

        if (heatCard) {
            if (AppState.paceView.heat) heatCard.classList.add('active');
            else heatCard.classList.remove('active');
        }

        if (windCard) {
            if (AppState.paceView.headwind || AppState.paceView.tailwind) windCard.classList.add('active');
            else windCard.classList.remove('active');
        }

        const altCard = document.querySelector('[data-toggle-target="altitude"]');
        if (altCard) {
            if (AppState.paceView.altitude) altCard.classList.add('active');
            else altCard.classList.remove('active');
        }
    };

    document.querySelectorAll('.clickable-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Skip if click was on an info tooltip icon
            if (e.target.closest('[data-action="info-tooltip"]')) return;

            const target = e.currentTarget.dataset.toggleTarget;

            if (target === 'heat') {
                AppState.paceView.heat = !AppState.paceView.heat;
            } else if (target === 'wind') {
                const newState = !AppState.paceView.headwind;
                AppState.paceView.headwind = newState;
                AppState.paceView.tailwind = newState;
            } else if (target === 'altitude') {
                AppState.paceView.altitude = !AppState.paceView.altitude;
            }

            updateImpactCards();
            UI.update(els, AppState.hapCalc);
        });

        // Basic keyboard accessibility
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
    });

    // Inputs (Distance, Temp, Dew, Wind)
    const inputs = [els.distance, els.temp, els.dew, els.wind];
    inputs.forEach(el => {
        if (el) el.addEventListener('input', () => {
            // Auto-Select Preset Logic
            if (el === els.distance) {
                const val = el.value.trim();
                const options = Array.from(els.preset.options).map(o => o.value);

                // Check if value matches any preset (exact match)
                if (options.includes(val)) {
                    els.preset.value = val;
                } else {
                    // If not currently on a valid preset for this value, switch to custom.
                    // But if user selected a preset, the value IS set.
                    // So if we type 5000, we select 5k.
                    // If we type 5001, we should select Custom.
                    els.preset.value = 'custom';
                }
            }
            UI.update(els, AppState.hapCalc);
            saveCalcState(els);
        });
    });

    // Fine-Tuning (arrow key acceleration)
    setupFineTuning(els.time, 'time', els, UI.update);
    setupFineTuning(els.inputPace, 'time', els, UI.update);
    setupFineTuning(els.distance, 'dist', els, UI.update);

    // Settings Modal
    initSettings(els, UI.update);

    // Load saved settings (weight, age, gender, altitude, units)
    loadSavedSettings();

    // Time Input: Calculate Pace from Time + Distance
    if (els.time) {
        els.time.addEventListener('input', () => {
            UI.update(els, AppState.hapCalc);
            saveCalcState(els);
            // Also update Pace field if distance is set
            const tSec = parseTime(els.time.value);
            const d = parseFloat(els.distance.value);
            if (tSec > 0 && d > 0 && els.inputPace) {
                const pacePerKm = tSec / (d / 1000);
                els.inputPace.value = formatTime(pacePerKm);
            }
        });
    }

    // Time Input Formatting (numeric keypad support) — imported from inputs.js

    if (els.inputPace) {
        els.inputPace.oninput = (e) => {
            handleTimeInput(e);
            UI.setPaceMode(null);
            UI.update(els, AppState.hapCalc);
        }
    }

    // Also apply to Time Trial Input
    if (els.time) {
        els.time.oninput = (e) => {
            handleTimeInput(e);
            UI.update(els, AppState.hapCalc);
            saveToStorage('last_time', e.target.value);
        }
    }

    // Preset Logic
    if (els.preset) {
        els.preset.addEventListener('change', () => {
            const val = els.preset.value;
            if (val !== 'custom') {
                els.distance.value = val;
                UI.update(els, AppState.hapCalc);
                saveCalcState(els);
            }
        });
    }

    // Modal Click Outside (Close)
    const locModal = document.getElementById('loc-modal');
    if (locModal) {
        locModal.addEventListener('click', (e) => {
            if (e.target === locModal) {
                locModal.classList.remove('open');
                locModal.style.removeProperty('display'); // Clear any inline override
            }
        });
    }

    // Pace Input: Calculate Time from Pace + Distance
    if (els.inputPace) {
        els.inputPace.addEventListener('input', () => {
            const p = parseTime(els.inputPace.value);
            const dStr = els.distance.value;
            if (p > 0 && dStr) {
                const d = parseFloat(dStr);
                const tSec = (d / 1000.0) * p;
                els.time.value = formatTime(tSec);
                UI.update(els, AppState.hapCalc);
                saveCalcState(els);
            }
        });
    }

    // Copy Button
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', () => UI.copyResults(els));

    // Click Outside to Dismiss Info Tooltip
    // Use mousedown so that link clicks (which fire on mouseup/click) still work
    document.addEventListener('mousedown', (e) => {
        const tooltip = document.getElementById('forecast-tooltip');
        if (!tooltip || tooltip.style.opacity !== '1') return;
        // If mousedown is inside the tooltip, don't hide (allow link clicks).
        if (tooltip.contains(e.target)) return;
        // If mousedown is on an info icon, showInfoTooltip will handle toggle.
        if (e.target.closest('[onclick*="showInfoTooltip"]')) return;
        // Otherwise, hide.
        UI.hideForeTooltip();
    });

    // Initial Load
    // Load State done in LocationManager for location, but inputs?
    // We need to load input state.
    const savedState = loadFromStorage('vdot_calc_state');
    if (savedState) {
        if (els.distance) {
            els.distance.value = savedState.distance || '';
            // Trigger auto-select logic
            els.distance.dispatchEvent(new Event('input'));
        }
        if (els.time && savedState.time) {
            // Format the saved time to ensure MM:SS display
            const timeSec = parseTime(savedState.time);
            els.time.value = timeSec > 0 ? formatTime(timeSec) : savedState.time;
        }
    }

    // Initial Update
    UI.update(els, AppState.hapCalc);

    // Weather Fetch
    UI.setLoading('current', true);
    UI.setLoading('forecast', true);
    await refreshWeather();
    UI.setLoading('current', false);
    UI.setLoading('forecast', false);

    // Climate Load Removed (Lazy)
}

async function refreshWeather(force = false) {
    AppState.refreshWeather = refreshWeather;
    const loc = AppState.locManager.current;
    if (!loc) return;

    try {
        const { weather, air } = await fetchWeatherData(loc.lat, loc.lon);

        UI.setForecastData(processForecast(weather.hourly));
        AppState.weatherData = weather;
        AppState.airData = air;

        UI.renderCurrentTab(weather.current, air.current,
            weather.hourly.precipitation_probability[0],
            weather.hourly.precipitation[0],
            weather.daily,
            weather.elevation
        );

        UI.renderAllForecasts();

        const els = AppState.els;
        if ((!els.temp.value && !els.dew.value) || force) {
            els.temp.value = weather.current.temperature_2m;
            els.dew.value = weather.current.dew_point_2m;
            if (els.wind) els.wind.value = weather.current.wind_speed_10m;
            UI.update(els, AppState.hapCalc);
        }

        AppState.altitude.current = weather.elevation || 0;
        UI.renderAltitudeCard();

    } catch (e) {
        console.error("Weather Refresh Failed", e);
    }
}

function processForecast(hourly) {
    // Transform OpenMeteo hourly arrays to array of objects
    if (!hourly) return [];
    const len = hourly.time.length;
    const data = [];
    for (let i = 0; i < len; i++) {
        data.push({
            time: hourly.time[i],
            temp: hourly.temperature_2m[i],
            dew: hourly.dew_point_2m[i],
            rain: hourly.precipitation[i],
            prob: hourly.precipitation_probability[i],
            wind: hourly.wind_speed_10m[i],
            dir: hourly.wind_direction_10m[i],
            weathercode: hourly.weather_code[i]
        });
    }
    return data;
}

// --- Lazy Loader ---
async function loadClimateModule() {
    if (AppState.climateManager) return;

    UI.setLoading('climate', true);

    try {
        const { ClimateManager } = await import('./modules/climate_manager.js');
        AppState.climateManager = new ClimateManager(AppState.locManager, (data) => {
            UI.setClimateData(data);
            UI.renderClimateHeatmap();
            UI.renderClimateTable();
        });
        await AppState.climateManager.loadDataForCurrentLocation();
    } catch (e) {
        console.error("Failed to lazy load Climate Manager", e);
    } finally {
        UI.setLoading('climate', false);
    }
}

// --- Global Event Delegation ---
function setupGlobalEvents() {
    console.log("Setting up global events...");

    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        // console.log("Action:", action, target.dataset);

        switch (action) {
            case 'tab':
                if (target.dataset.tab === 'climate') loadClimateModule();
                UI.openTab(target.dataset.tab, target);
                break;
            case 'location-modal':
                UI.openLocationModal();
                break;
            case 'location-close':
                UI.closeLocationModal();
                break;
            case 'location-search-clear':
                // Reset search logic if needed
                const searchInp = document.getElementById('loc-search');
                if (searchInp) searchInp.value = '';
                // renderRecents logic is inside ui.js, might need to call it
                break;
            case 'gps':
                UI.useGPS();
                break;
            case 'vdot-details':
                UI.toggleVDOTDetails(e);
                break;
            case 'insight-range':
                UI.setBestRunRange(target.dataset.range, e);
                break;
            case 'select-forecast':
                UI.toggleForeSelection(target.dataset.time || null, e);
                break;
            case 'filter-climate':
                // For the 'X' button on climate filter
                UI.toggleClimateFilter(null, null, e);
                break;
            case 'filter-impact':
                // For legend items
                UI.toggleImpactFilter(target.dataset.category);
                break;
            case 'pace-mode':
                UI.setPaceMode(target.dataset.mode);
                break;
            case 'sort-forecast':
                UI.toggleForeSort(target.dataset.col);
                break;
            case 'sort-climate':
            case 'sort-climate':
                UI.sortClimate(target.dataset.col);
                break;
            case 'chart-interact':
                // Click on Chart
                UI.handleChartClick(e,
                    parseFloat(target.dataset.totalW),
                    parseFloat(target.dataset.chartW),
                    parseFloat(target.dataset.padLeft),
                    parseInt(target.dataset.len)
                );
                break;
            case 'monthly-type':
                UI.UIState.selectedMonthlyType = target.dataset.type;
                if (target.parentElement) {
                    target.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                    target.classList.add('active');
                }
                UI.renderMonthlyAverages();
                break;
            case 'toggle-favorite':
                UI.toggleLocationFavorite();
                break;
            case 'toggle-dropdown':
                UI.toggleLocationDropdown(target);
                break;
            case 'info-tooltip':
                e.preventDefault();
                e.stopPropagation();
                UI.showInfoTooltip(e, target.dataset.title || '', target.dataset.text || '');
                break;
            case 'toggle-temp-chart':
                UI.toggleTempChart();
                break;
            case 'toggle-rain-chart':
                UI.toggleRainChart();
                break;
            case 'toggle-wind-chart':
                UI.toggleWindChart();
                break;
            case 'toggle-monthly':
                UI.toggleMonthlyAverages();
                break;
            case 'copy-conditions':
                UI.copyConditions();
                break;
            case 'climate-cell':
                UI.toggleClimateFilter(
                    parseInt(target.dataset.week),
                    parseInt(target.dataset.hour),
                    e
                );
                break;
            case 'filter-climate-impact':
                UI.filterClimateByImpact(target.dataset.label, target);
                break;
        }
    });

    // Hover Events for Heatmap (Delegated)
    document.addEventListener('mousemove', (e) => {
        let target = e.target.closest('[data-action="select-forecast"]');
        if (target) {
            UI.handleCellHover(e, target);
            UI.moveForeTooltip(e);
            return;
        }

        target = e.target.closest('[data-action="chart-interact"]');
        if (target) {
            UI.handleChartHover(e,
                parseFloat(target.dataset.totalW),
                parseFloat(target.dataset.chartW),
                parseFloat(target.dataset.padLeft),
                parseInt(target.dataset.len)
            );
        }

        // Climate heatmap tooltip move
        target = e.target.closest('[data-action="climate-cell"]');
        if (target) {
            UI.moveClimateTooltip(e);
        }
    });

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-action="select-forecast"]');
        if (target) {
            UI.handleCellHover(e, target);
            return;
        }
        // Climate heatmap hover enter
        const climateTarget = e.target.closest('[data-action="climate-cell"]');
        if (climateTarget) {
            UI.showClimateTooltip(e,
                parseInt(climateTarget.dataset.week),
                parseInt(climateTarget.dataset.hour),
                parseFloat(climateTarget.dataset.impact),
                parseFloat(climateTarget.dataset.temp),
                parseFloat(climateTarget.dataset.dew),
                parseInt(climateTarget.dataset.count)
            );
        }
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-action="select-forecast"]');
        if (target) {
            UI.hideForeTooltip();
            return;
        }
        const chartTarget = e.target.closest('[data-action="chart-interact"]');
        if (chartTarget) {
            UI.hideForeTooltip();
            return;
        }
        const climateTarget = e.target.closest('[data-action="climate-cell"]');
        if (climateTarget) {
            UI.hideClimateTooltip();
        }
    });
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

setupGlobalEvents();
UI.setupTableScrollListeners();
