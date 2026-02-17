// Main Entry Point
import { HAPCalculator, parseTime, formatTime } from './modules/core.js';
import { LocationManager } from './modules/managers.js';
import { fetchWeatherData } from './modules/api.js';
import { HAP_GRID } from '../data/hap_grid.js';
import { AppState } from './modules/appState.js';
import { AppStore, StoreActions, RequestKeys, beginRequest, endRequest, isRequestCurrent } from './modules/store.js';

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
        AppStore.dispatch(StoreActions.setHapCalc(new HAPCalculator(HAP_GRID)));
    } else {
        console.error("HAP_GRID failed to load");
    }

    // 2. Managers
    const locManager = new LocationManager(async (loc) => {
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
    AppStore.dispatch(StoreActions.setLocManager(locManager));

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
    AppStore.dispatch(StoreActions.setEls(els));

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
                AppStore.dispatch(StoreActions.patchPaceView({
                    heat: !AppState.paceView.heat
                }));
            } else if (target === 'wind') {
                const newState = !AppState.paceView.headwind;
                AppStore.dispatch(StoreActions.patchPaceView({
                    headwind: newState,
                    tailwind: newState
                }));
            } else if (target === 'altitude') {
                AppStore.dispatch(StoreActions.patchPaceView({
                    altitude: !AppState.paceView.altitude
                }));
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

    const syncPaceFromTime = () => {
        const tSec = parseTime(els.time ? els.time.value : '');
        const d = parseFloat(els.distance ? els.distance.value : '');
        if (tSec > 0 && d > 0 && els.inputPace) {
            const pacePerKm = tSec / (d / 1000);
            els.inputPace.value = formatTime(pacePerKm);
        }
    };

    const syncTimeFromPace = () => {
        const p = parseTime(els.inputPace ? els.inputPace.value : '');
        const d = parseFloat(els.distance ? els.distance.value : '');
        if (p > 0 && d > 0 && els.time) {
            const tSec = (d / 1000) * p;
            els.time.value = formatTime(tSec);
        }
    };

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
                syncPaceFromTime();
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

    // Time & Pace Inputs (single handlers to avoid duplicate work)
    if (els.time) {
        els.time.addEventListener('input', (e) => {
            handleTimeInput(e);
            syncPaceFromTime();
            UI.update(els, AppState.hapCalc);
            saveCalcState(els);
            saveToStorage('last_time', e.target.value);
        });
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

    if (els.inputPace) {
        els.inputPace.addEventListener('input', (e) => {
            handleTimeInput(e);
            UI.setPaceMode(null);
            syncTimeFromPace();
            UI.update(els, AppState.hapCalc);
            saveCalcState(els);
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
        if (e.target.closest('[data-action="info-tooltip"]')) return;
        // Keep tooltip when interacting with heatmap/chart points.
        if (e.target.closest('[data-action="climate-cell"]')) return;
        if (e.target.closest('[data-action="select-forecast"]')) return;
        if (e.target.closest('[data-action="chart-interact"]')) return;
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

let climateModulePromise = null;

async function refreshWeather(force = false) {
    AppStore.dispatch(StoreActions.setRefreshWeather(refreshWeather));
    const loc = AppState.locManager.current;
    if (!loc) return;
    const request = beginRequest(RequestKeys.WEATHER, {
        abortPrevious: true,
        meta: { lat: loc.lat, lon: loc.lon }
    });

    try {
        const { weather, air } = await fetchWeatherData(loc.lat, loc.lon, {
            signal: request.signal,
            force
        });

        // Ignore stale responses from superseded requests.
        if (!isRequestCurrent(RequestKeys.WEATHER, request.seq)) return;

        UI.setForecastData(processForecast(weather.hourly));
        AppStore.dispatch(StoreActions.setWeatherData(weather));
        AppStore.dispatch(StoreActions.setAirData(air));

        UI.renderCurrentTab(weather.current, air.current,
            weather.hourly.precipitation_probability[0],
            weather.hourly.precipitation[0],
            weather.daily,
            weather.elevation
        );

        UI.renderAllForecasts({ data: true, range: true, selection: true });

        const els = AppState.els;
        if ((!els.temp.value && !els.dew.value) || force) {
            els.temp.value = weather.current.temperature_2m;
            els.dew.value = weather.current.dew_point_2m;
            if (els.wind) els.wind.value = weather.current.wind_speed_10m;
            UI.update(els, AppState.hapCalc);
        }

        AppStore.dispatch(StoreActions.patchAltitude({
            current: weather.elevation || 0
        }));
        UI.renderAltitudeCard();
        endRequest(RequestKeys.WEATHER, request.seq, 'success');

    } catch (e) {
        if (e && e.name === 'AbortError') {
            endRequest(RequestKeys.WEATHER, request.seq, 'aborted');
            return;
        }
        endRequest(RequestKeys.WEATHER, request.seq, 'error', e && e.message ? e.message : 'Weather refresh failed');
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
    UI.setLoading('climate', true);

    try {
        if (!AppState.climateManager) {
            climateModulePromise = climateModulePromise || import('./modules/climate_manager.js');
            const { ClimateManager } = await climateModulePromise;
            const climateManager = new ClimateManager(AppState.locManager, (data) => {
                UI.setClimateData(data);
                UI.renderClimateHeatmap();
                UI.renderClimateTable();
            });
            AppStore.dispatch(StoreActions.setClimateManager(climateManager));
        }
        await AppState.climateManager.loadDataForCurrentLocation();
    } catch (e) {
        climateModulePromise = null;
        console.error("Failed to lazy load Climate Manager", e);
    } finally {
        UI.setLoading('climate', false);
    }
}

// --- Global Event Delegation ---
function setupGlobalEvents() {
    console.log("Setting up global events...");
    const isTouchViewport = () =>
        typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: none), (pointer: coarse)').matches;

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
            case 'location-search-clear': {
                // Reset search logic if needed
                const searchInp = document.getElementById('loc-search');
                if (searchInp) searchInp.value = '';
                // renderRecents logic is inside ui.js, might need to call it
                break;
            }
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
                if (isTouchViewport()) {
                    e.__keepTooltipOpen = true;
                    UI.handleCellHover(e, target);
                }
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
                UI.sortClimate(target.dataset.col);
                break;
            case 'chart-interact':
                // Click on Chart
                if (isTouchViewport()) {
                    e.__keepTooltipOpen = true;
                    UI.handleChartHover(e,
                        parseFloat(target.dataset.totalW),
                        parseFloat(target.dataset.chartW),
                        parseFloat(target.dataset.padLeft),
                        parseInt(target.dataset.len)
                    );
                }
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
                e.__keepTooltipOpen = true;
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
                if (isTouchViewport()) {
                    e.__keepTooltipOpen = true;
                    UI.showClimateTooltip(e,
                        parseInt(target.dataset.week),
                        parseInt(target.dataset.hour),
                        parseFloat(target.dataset.impact),
                        parseFloat(target.dataset.temp),
                        parseFloat(target.dataset.dew),
                        parseInt(target.dataset.count)
                    );
                }
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

    // Hover Events for Heatmap (Delegated + RAF throttle)
    const handleMouseMove = (e) => {
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
    };

    let mouseMoveRaf = 0;
    let lastMouseEvent = null;
    document.addEventListener('mousemove', (e) => {
        if (isTouchViewport()) return;
        lastMouseEvent = e;
        if (mouseMoveRaf) return;
        mouseMoveRaf = requestAnimationFrame(() => {
            mouseMoveRaf = 0;
            if (lastMouseEvent) handleMouseMove(lastMouseEvent);
        });
    });

    document.addEventListener('mouseover', (e) => {
        if (isTouchViewport()) return;
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
        if (isTouchViewport()) return;
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
