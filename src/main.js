// Main Entry Point
import { HAPCalculator, parseTime, formatTime } from './modules/core.js';
import { LocationManager } from './modules/managers.js';
import { fetchWeatherData } from './modules/api.js';
import { HAP_GRID } from '../data/hap_grid.js';
import { AppState } from './modules/appState.js';
import { AppStore, StoreActions, RequestKeys, beginRequest, endRequest, isRequestCurrent } from './modules/store.js';
import { initObservability, reportError, reportEvent, measureAsync } from './modules/observability.js';

import * as UI from './modules/ui.js';
import { loadFromStorage, saveToStorage } from './modules/storage.js';
import { formatTimeInput, handleTimeInput, setupFineTuning, saveCalcState } from './modules/inputs.js';
import { initSettings, loadSavedSettings } from './modules/settings.js';
import { formatEditableValue, toDisplayTemperature, toDisplayWind, updateUnitLabels } from './modules/units.js';

const APP_VERSION = '1.0.25';
console.log(`Main JS Starting... v${APP_VERSION}`);

function isNativeInteractiveElement(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'button'
        || tag === 'a'
        || tag === 'input'
        || tag === 'select'
        || tag === 'textarea'
        || tag === 'summary';
}

function bootstrapAccessibility() {
    const view = document.getElementById('view-weather');
    if (!view) return;
    const noTabStopActions = new Set(['climate-cell', 'select-forecast', 'chart-interact']);

    const uiState = AppStore.getState().ui;
    UI.updateWeatherTabState(view, uiState.activeWeatherTab || 'calculator');

    document.querySelectorAll('[data-action]').forEach((el) => {
        const action = el.dataset.action || '';
        if (noTabStopActions.has(action)) return;
        if (isNativeInteractiveElement(el)) return;
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    });

    document.querySelectorAll('[data-action="info-tooltip"]').forEach((el, index) => {
        if (!el.hasAttribute('aria-label')) {
            const title = (el.dataset.title || '').trim();
            el.setAttribute('aria-label', title ? `Info: ${title}` : `Info ${index + 1}`);
        }
    });

    const tooltip = document.getElementById('forecast-tooltip');
    if (tooltip) {
        tooltip.setAttribute('role', 'dialog');
        tooltip.setAttribute('aria-live', 'polite');
    }
}

// --- Initialization ---
async function init() {
    console.log("Initializing App...");
    initObservability({ version: APP_VERSION });
    reportEvent('init_start', { version: APP_VERSION });

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
            .catch((err) => {
                reportError(err, { stage: 'location_change_refresh' });
                console.error(err);
            })
            .finally(() => {
                UI.setLoading('current', false);
                UI.setLoading('forecast', false);
            });

        if (AppState.climateManager) {
            UI.setLoading('climate', true);
            AppState.climateManager.loadDataForCurrentLocation()
                .catch((err) => {
                    reportError(err, { stage: 'location_change_climate_refresh' });
                    console.error(err);
                })
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
    bootstrapAccessibility();

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
                syncTimeFromPace();
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
    updateUnitLabels(AppState.unitSystem);

    document.addEventListener('runweather:unit-system-changed', () => {
        updateUnitLabels(AppState.unitSystem);
        UI.update(els, AppState.hapCalc);

        const weather = AppState.weatherData || {};
        const hourly = weather.hourly || {};
        const current = weather.current || null;
        const daily = weather.daily || null;
        const airCurrent = (AppState.airData && AppState.airData.current) ? AppState.airData.current : {};
        const firstProb = Array.isArray(hourly.precipitation_probability) ? (hourly.precipitation_probability[0] ?? 0) : 0;
        const firstPrecip = Array.isArray(hourly.precipitation) ? (hourly.precipitation[0] ?? 0) : 0;

        if (current) {
            UI.renderCurrentTab(current, airCurrent, firstProb, firstPrecip, daily, weather.elevation);
        }

        UI.renderAllForecasts({ force: true, layout: true, data: true });

        if ((AppStore.getState().ui.climateData || []).length > 0) {
            UI.renderClimateHeatmap();
            UI.renderClimateTable();
            UI.renderClimateLegend();
            UI.renderMonthlyAverages();
        }
    });

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
                syncTimeFromPace();
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
                UI.closeLocationModal();
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
        const { weather, air } = await measureAsync('weather_fetch', () => fetchWeatherData(loc.lat, loc.lon, {
            signal: request.signal,
            force
        }), {
            force,
            lat: loc.lat,
            lon: loc.lon,
            seq: request.seq
        });

        // Ignore stale responses from superseded requests.
        if (!isRequestCurrent(RequestKeys.WEATHER, request.seq)) {
            reportEvent('weather_stale_ignored', { seq: request.seq, lat: loc.lat, lon: loc.lon }, 'warn');
            return;
        }

        const hourly = weather && weather.hourly ? weather.hourly : {};
        const daily = weather && weather.daily ? weather.daily : {};
        const current = weather && weather.current ? weather.current : {};
        const airCurrent = air && air.current ? air.current : {};
        const firstProb = Array.isArray(hourly.precipitation_probability) ? (hourly.precipitation_probability[0] ?? 0) : 0;
        const firstPrecip = Array.isArray(hourly.precipitation) ? (hourly.precipitation[0] ?? 0) : 0;

        const renderStarted = performance.now();
        UI.setForecastData(processForecast(hourly));
        AppStore.dispatch(StoreActions.setWeatherData(weather));
        AppStore.dispatch(StoreActions.setAirData(air));

        UI.renderCurrentTab(current, airCurrent,
            firstProb,
            firstPrecip,
            daily,
            weather.elevation
        );

        UI.renderAllForecasts({ data: true, range: true, selection: true });
        reportEvent('weather_render', {
            seq: request.seq,
            durationMs: Number((performance.now() - renderStarted).toFixed(2)),
            points: Array.isArray(hourly.time) ? hourly.time.length : 0
        });

        const els = AppState.els;
        if ((!els.temp.value && !els.dew.value) || force) {
            els.temp.value = formatEditableValue(toDisplayTemperature(current.temperature_2m ?? 0), 1);
            els.dew.value = formatEditableValue(toDisplayTemperature(current.dew_point_2m ?? 0), 1);
            if (els.wind) els.wind.value = formatEditableValue(toDisplayWind(current.wind_speed_10m ?? 0), 1);
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
        reportError(e, {
            stage: 'refreshWeather',
            force,
            seq: request.seq,
            lat: loc.lat,
            lon: loc.lon
        });
        console.error("Weather Refresh Failed", e);
    }
}

function processForecast(hourly) {
    // Transform OpenMeteo hourly arrays to array of objects with defensive shape guards.
    if (!hourly || typeof hourly !== 'object') return [];
    const fields = [
        'time',
        'temperature_2m',
        'dew_point_2m',
        'precipitation',
        'precipitation_probability',
        'wind_speed_10m',
        'wind_direction_10m',
        'weather_code'
    ];
    const len = fields.reduce((maxLen, key) => {
        const arr = hourly[key];
        if (!Array.isArray(arr)) return maxLen;
        return Math.max(maxLen, arr.length);
    }, 0);
    if (len <= 0) return [];

    const valueAt = (key, idx, fallback = null) => {
        const arr = hourly[key];
        if (!Array.isArray(arr)) return fallback;
        const val = arr[idx];
        return val == null ? fallback : val;
    };

    const data = [];
    for (let i = 0; i < len; i++) {
        data.push({
            time: valueAt('time', i, ''),
            temp: valueAt('temperature_2m', i, null),
            dew: valueAt('dew_point_2m', i, null),
            rain: valueAt('precipitation', i, 0),
            prob: valueAt('precipitation_probability', i, 0),
            wind: valueAt('wind_speed_10m', i, null),
            dir: valueAt('wind_direction_10m', i, null),
            weathercode: valueAt('weather_code', i, null)
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
        await measureAsync('climate_load', () => AppState.climateManager.loadDataForCurrentLocation(), {
            lat: AppState.locManager && AppState.locManager.current ? AppState.locManager.current.lat : null,
            lon: AppState.locManager && AppState.locManager.current ? AppState.locManager.current.lon : null
        });
    } catch (e) {
        climateModulePromise = null;
        reportError(e, { stage: 'loadClimateModule' });
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
    let lastInfoTooltipTouchTs = 0;

    // Touch-first fallback for info tooltips (some mobile browsers are inconsistent with click on dynamic inline icons).
    document.addEventListener('touchend', (e) => {
        const target = e.target.closest('[data-action="info-tooltip"]');
        if (!target || !isTouchViewport()) return;
        e.preventDefault();
        e.stopPropagation();
        e.__keepTooltipOpen = true;
        lastInfoTooltipTouchTs = Date.now();
        UI.showInfoTooltip(e, target.dataset.title || '', target.dataset.text || '');
    }, { passive: false });

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
                AppStore.dispatch(StoreActions.patchUI({
                    selectedMonthlyType: target.dataset.type
                }));
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
                // Ignore delayed synthetic click right after touchend to avoid immediate toggle-close.
                if (isTouchViewport() && (Date.now() - lastInfoTooltipTouchTs) < 500) {
                    break;
                }
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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            UI.hideForeTooltip();
            UI.closeLocationModal();
            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal && settingsModal.classList.contains('open')) {
                const closeSettings = document.getElementById('close-settings');
                if (closeSettings) closeSettings.click();
            }
            return;
        }

        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;

        if (action === 'tab' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) {
            const tabs = Array.from(document.querySelectorAll('#view-weather .tab-nav .tab-btn'));
            if (tabs.length === 0) return;
            const currentIndex = tabs.indexOf(target);
            if (currentIndex < 0) return;

            let nextIndex = currentIndex;
            if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
            if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            if (e.key === 'Home') nextIndex = 0;
            if (e.key === 'End') nextIndex = tabs.length - 1;

            const next = tabs[nextIndex];
            if (!next) return;
            e.preventDefault();
            next.focus();
            next.click();
            return;
        }

        const shouldActivate = e.key === 'Enter' || e.key === ' ';
        if (!shouldActivate) return;
        if (isNativeInteractiveElement(target)) return;

        e.preventDefault();
        target.click();
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
