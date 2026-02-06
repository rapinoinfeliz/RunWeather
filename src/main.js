// Main Entry Point
import { HAPCalculator, parseTime, formatTime } from './modules/core.js';
import { LocationManager } from './modules/managers.js';
import { fetchWeatherData } from './modules/api.js';
import { HAP_GRID } from '../data/hap_grid.js'; // Import data module

import * as UI from './modules/ui.js';
import { loadFromStorage, saveToStorage } from './modules/storage.js';

console.log("Main JS Starting... v1.0.16");

// --- Expose UI to Window (Legacy Support) ---
console.log("UI Keys:", Object.keys(UI));
Object.keys(UI).forEach(key => {
    window[key] = UI[key];
});
console.log("UI Exposed. openTab is:", typeof window.openTab);

// --- Global State ---
window.hapCalc = null; // Will be init with data
window.locManager = null;
window.climateManager = null;

// --- Initialization ---
async function init() {
    console.log("Initializing App...");

    // 1. Core Logic
    if (HAP_GRID) {
        window.hapCalc = new HAPCalculator(HAP_GRID);
    } else {
        console.error("HAP_GRID failed to load");
    }

    // 2. Managers
    window.locManager = new LocationManager(async (loc) => {
        // On Location Change

        // 1. Update UI Text Immediately
        document.querySelectorAll('.current-location-name').forEach(el => {
            el.textContent = loc.name;
        });
        UI.closeLocationModal();

        // 2. Clear/Update Calc
        UI.update(window.els, window.hapCalc);

        // 3. Trigger Loads Independently
        UI.setLoading('current', true);
        UI.setLoading('forecast', true);

        refreshWeather(true)
            .catch(console.error)
            .finally(() => {
                UI.setLoading('current', false);
                UI.setLoading('forecast', false);
            });

        if (window.climateManager) {
            UI.setLoading('climate', true);
            window.climateManager.loadDataForCurrentLocation()
                .catch(console.error)
                .finally(() => UI.setLoading('climate', false));
        }

        // 4. Update Star Status
        if (window.updateFavoriteStar) window.updateFavoriteStar();
    });



    // Set initial location button text from saved state
    document.querySelectorAll('.current-location-name').forEach(el => {
        el.textContent = window.locManager.current.name;
    });
    if (window.updateFavoriteStar) window.updateFavoriteStar();

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
    window.els = els; // Export for UI module if it uses window.els (my implementation passed 'els' to update)

    // Attach Window Helpers (Tooltips, specific onclicks)
    UI.setupWindowHelpers();

    // Auto-format time inputs on blur (e.g., "1920" -> "19:20")
    const formatTimeInput = (el) => {
        if (!el) return;
        el.addEventListener('blur', () => {
            let val = el.value.replace(/[^0-9]/g, ''); // Remove all non-digits
            if (val.length === 0) return;
            // Pad to at least 3 digits for proper parsing
            if (val.length === 1) val = '0' + val; // "5" -> "05" (5 seconds)
            if (val.length === 2) val = '0' + val; // "30" -> "030" (30 seconds)
            // Now split: last 2 are seconds, rest are minutes
            const secs = val.slice(-2);
            const mins = val.slice(0, -2) || '0';
            el.value = `${parseInt(mins, 10)}:${secs}`;
        });
    };
    formatTimeInput(els.time);
    formatTimeInput(els.inputPace);

    // Attach Event Listeners
    // Initialize Pace View State
    window.pace_view = { heat: false, headwind: false, tailwind: false };

    // Impact Card Toggle Logic
    const updateImpactCards = () => {
        const heatCard = document.querySelector('[data-toggle-target="heat"]');
        const windCard = document.querySelector('[data-toggle-target="wind"]');

        if (heatCard) {
            if (window.pace_view.heat) heatCard.classList.add('active');
            else heatCard.classList.remove('active');
        }

        if (windCard) {
            // Active if either headwind or tailwind is enabled (they are synced now)
            if (window.pace_view.headwind || window.pace_view.tailwind) windCard.classList.add('active');
            else windCard.classList.remove('active');
        }
    };

    document.querySelectorAll('.clickable-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.toggleTarget; // using currentTarget to get the card div

            if (target === 'heat') {
                window.pace_view.heat = !window.pace_view.heat;
            } else if (target === 'wind') {
                // Toggle both together
                const newState = !window.pace_view.headwind; // Toggle based on one
                window.pace_view.headwind = newState;
                window.pace_view.tailwind = newState;
            }

            updateImpactCards();
            UI.update(els, window.hapCalc);
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
            UI.update(els, window.hapCalc);
            saveCalcState();
        });
    });

    // --- Auto-Save Helper ---
    const saveCalcState = () => {
        const state = {
            distance: els.distance ? els.distance.value : '',
            time: els.time ? els.time.value : ''
        };
        saveToStorage('vdot_calc_state', state);
    };

    // --- Fine-Tuning Helpers ---
    // Inline robust parsers to avoid import issues
    const localParseTime = (str) => {
        if (!str) return 0;
        str = str.toString().trim();
        if (str === '' || str === '--:--') return 0;
        const parts = str.split(':').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return parts[0] * 60 + parts[1];
        }
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        // Fallback to just digits
        const digits = str.replace(/[^0-9]/g, '');
        if (!digits) return 0;
        if (digits.length <= 2) return parseInt(digits, 10);
        const s = parseInt(digits.slice(-2), 10);
        const m = parseInt(digits.slice(0, -2), 10);
        return m * 60 + s;
    };

    const localFormatTime = (sec) => {
        if (isNaN(sec) || sec < 0) return "0:00";
        let m = Math.floor(sec / 60);
        let s = Math.round(sec % 60);
        if (s === 60) { m++; s = 0; }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const adjustTime = (valStr, deltaSec) => {
        const sec = localParseTime(valStr);
        let newSec = sec + deltaSec;
        if (newSec < 0) newSec = 0;
        return localFormatTime(newSec);
    };

    const adjustDistance = (valStr, deltaMeters) => {
        let val = parseFloat(valStr) || 0;
        let newVal = val + deltaMeters;
        if (newVal < 0) newVal = 0;
        return newVal; // Return number, input type number handles it
    };

    const setupFineTuning = (el, type) => {
        if (!el) return;

        // Acceleration State
        let repeatCount = 0;
        let lastKey = null;

        el.addEventListener('keyup', (e) => {
            repeatCount = 0;
            lastKey = null;
        });

        el.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();

                // Track Repeats for Acceleration
                if (lastKey === e.key) {
                    repeatCount++;
                } else {
                    repeatCount = 0;
                    lastKey = e.key;
                }

                const isUp = e.key === 'ArrowUp';
                const dir = isUp ? 1 : -1;

                if (type === 'time') {
                    // Time Acceleration (Optional, but nice consistency)
                    // Default: 1s. Turbo: 10s. Shift: 10s.
                    // Let's keep it simple for time as requested: 1s default. Shift 10s.
                    // Maybe add light acceleration? 
                    // Let's stick to the requested Distance logic first, but consistent turbo valid.
                    const turbo = e.shiftKey ? 10 : 1;
                    el.value = adjustTime(el.value, dir * turbo);
                } else if (type === 'dist') {
                    // Distance Acceleration
                    // Base: 1m
                    // Shift: 100m (Instant Turbo)
                    // Acceleration (Holding Key):
                    // < 5 repeats: 1m
                    // 5-20 repeats: 10m
                    // > 20 repeats: 100m

                    let step = 1;
                    if (e.shiftKey) {
                        step = 100;
                    } else {
                        if (repeatCount > 20) step = 100;
                        else if (repeatCount > 5) step = 10;
                        else step = 1;
                    }

                    el.value = adjustDistance(el.value, dir * step);
                }

                // Trigger standard input event so auto-select logic works
                // This input listener ALREADY calls UI.update and saveCalcState (see inputs.forEach listener)
                el.dispatchEvent(new Event('input'));

                // Specific Input Logic (Calculated fields)
                if (el === els.time) {
                    // Update Pace from Time/Dist
                    const tSec = localParseTime(els.time.value);
                    const d = parseFloat(els.distance.value);
                    if (tSec > 0 && d > 0 && els.inputPace) {
                        const pacePerKm = tSec / (d / 1000);
                        els.inputPace.value = localFormatTime(pacePerKm);
                    }
                } else if (el === els.inputPace) {
                    // Update Time from Pace/Dist
                    const p = localParseTime(els.inputPace.value);
                    const dStr = els.distance.value;
                    if (p > 0 && dStr) {
                        const d = parseFloat(dStr);
                        const tSec = (d / 1000.0) * p;
                        els.time.value = localFormatTime(tSec);
                        UI.update(els, window.hapCalc); // Update again with new time
                    }
                } else if (el === els.distance) {
                    // Update pace based on new distance (keeping time constant)
                    const tSec = localParseTime(els.time.value);
                    const d = parseFloat(els.distance.value);
                    if (tSec > 0 && d > 0 && els.inputPace) {
                        const pacePerKm = tSec / (d / 1000);
                        els.inputPace.value = localFormatTime(pacePerKm);
                    }
                }
            }
        });
    };

    setupFineTuning(els.time, 'time');
    setupFineTuning(els.inputPace, 'time'); // Treated same as time (MM:SS)
    setupFineTuning(els.distance, 'dist');
    const savedUnitSystem = loadFromStorage('unit_system');
    window.unitSystem = savedUnitSystem || 'metric';

    // Settings Button Logic (Modal)
    const settingsModal = document.getElementById('settings-modal');
    if (els.btnSettings && settingsModal) {
        const closeBtn = document.getElementById('close-settings');
        const saveBtn = document.getElementById('save-settings');
        const weightInput = document.getElementById('runner-weight');
        const radios = document.getElementsByName('unit-system');

        const closeSettings = () => {
            settingsModal.classList.remove('open');
            settingsModal.style.removeProperty('display');
        };

        const openSettings = () => {
            // 1. Set Weight
            if (weightInput) {
                // Convert stored KG to LBS if in Imperial
                let val = window.runnerWeight || 65;
                if (window.unitSystem === 'imperial') {
                    val = val * 2.20462;
                    val = Math.round(val * 10) / 10;
                }
                weightInput.value = val;
            }

            // 2. Set Radio
            const currentSystem = window.unitSystem || 'metric';
            for (const radio of radios) {
                if (radio.value === currentSystem) radio.checked = true;
            }

            settingsModal.classList.add('open');
            settingsModal.style.display = 'flex';
        };

        const saveSettings = () => {
            // 1. Unit System
            let newSystem = 'metric';
            for (const radio of radios) {
                if (radio.checked) newSystem = radio.value;
            }

            // Check if system changed
            const systemChanged = newSystem !== window.unitSystem;
            window.unitSystem = newSystem;
            saveToStorage('unit_system', newSystem);

            // 2. Weight
            const val = parseFloat(weightInput.value);
            if (!isNaN(val) && val > 0) {
                let weightKg = val;
                if (newSystem === 'imperial') {
                    // Input was lbs, convert to kg for storage
                    weightKg = val / 2.20462;
                }

                window.runnerWeight = weightKg;
                saveToStorage('runner_weight', weightKg);

                UI.update(els, window.hapCalc);
                closeSettings();

            } else {
                alert("Please enter a valid weight.");
            }
        };

        els.btnSettings.addEventListener('click', openSettings);

        if (closeBtn) closeBtn.addEventListener('click', closeSettings);
        if (saveBtn) saveBtn.addEventListener('click', saveSettings);

        // Click outside to close
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettings();
        });

        // Dynamic Label Updates on Radio Change
        radios.forEach(r => {
            r.addEventListener('change', () => {
                const lbl = document.querySelector('label[for="runner-weight"]');
                if (lbl) {
                    lbl.textContent = `Runner Weight (${r.value === 'imperial' ? 'lbs' : 'kg'})`;
                }
                if (weightInput.value) {
                    let v = parseFloat(weightInput.value);
                    if (!isNaN(v)) {
                        if (r.value === 'imperial') {
                            v = v * 2.20462;
                        } else {
                            v = v / 2.20462;
                        }
                        weightInput.value = Math.round(v * 10) / 10;
                    }
                }
            });
        });
    }

    // Load Weight on Init
    const savedWeight = loadFromStorage('runner_weight');
    if (savedWeight) {
        window.runnerWeight = parseFloat(savedWeight);
    } else {
        window.runnerWeight = 65;
    }

    // Time Input: Calculate Pace from Time + Distance
    if (els.time) {
        els.time.addEventListener('input', () => {
            UI.update(els, window.hapCalc);
            saveCalcState();
            // Also update Pace field if distance is set
            const tSec = parseTime(els.time.value);
            const d = parseFloat(els.distance.value);
            if (tSec > 0 && d > 0 && els.inputPace) {
                const pacePerKm = tSec / (d / 1000);
                els.inputPace.value = formatTime(pacePerKm);
            }
        });
    }

    // Preset Logic
    if (els.preset) {
        els.preset.addEventListener('change', () => {
            const val = els.preset.value;
            if (val !== 'custom') {
                els.distance.value = val;
                UI.update(els, window.hapCalc);
                saveCalcState();
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
                UI.update(els, window.hapCalc);
                saveCalcState();
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
    UI.update(els, window.hapCalc);

    // Weather Fetch
    UI.setLoading('current', true);
    UI.setLoading('forecast', true);
    await refreshWeather();
    UI.setLoading('current', false);
    UI.setLoading('forecast', false);

    // Climate Load Removed (Lazy)
}

async function refreshWeather(force = false) {
    window.refreshWeather = refreshWeather; // Expose for UI/FAB
    const loc = window.locManager.current;
    if (!loc) return;

    try {
        const { weather, air } = await fetchWeatherData(loc.lat, loc.lon);

        // Update Globals/UI State
        UI.setForecastData(processForecast(weather.hourly)); // We need to process it
        window.weatherData = weather; // for legacy
        window.airData = air;

        // Render Current
        UI.renderCurrentTab(weather.current, air.current,
            weather.hourly.precipitation_probability[0],
            weather.hourly.precipitation[0],
            weather.daily,
            weather.elevation // Pass Elevation
        );

        // Render Forecasts
        UI.renderAllForecasts();

        // Update Inputs if empty?
        const els = window.els;
        if ((!els.temp.value && !els.dew.value) || force) {
            els.temp.value = weather.current.temperature_2m;
            els.dew.value = weather.current.dew_point_2m;
            if (els.wind) els.wind.value = weather.current.wind_speed_10m;
            UI.update(els, window.hapCalc);
        }

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
// --- Lazy Loader ---
async function loadClimateModule() {
    if (window.climateManager) return;

    UI.setLoading('climate', true);

    try {
        const { ClimateManager } = await import('./modules/climate_manager.js');
        window.climateManager = new ClimateManager(window.locManager, (data) => {
            UI.setClimateData(data);
            UI.renderClimateHeatmap();
            UI.renderClimateTable();
        });
        await window.climateManager.loadDataForCurrentLocation();
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
                UI.toggleVDOTDetails();
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
                window.selectedMonthlyType = target.dataset.type;
                if (target.parentElement) {
                    target.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                    target.classList.add('active');
                }
                UI.renderMonthlyAverages();
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
            // Chart hover handles tooltip positioning internally? No, handleCellHover uses moveForeTooltip.
            // handleChartHover shows/moves tooltip itself.
        }
    });

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-action="select-forecast"]');
        if (target) {
            UI.handleCellHover(e, target);
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
        }
    });
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Call setup in init

// Wait, I can't modify Line 31 easily with this block which is at line 200.
// I will just run it at the end of the file? No, listeners should be set up early.
// I'll call it right before defining init? 
// Actually, I will replace the end of the file and invoke it.

setupGlobalEvents();
UI.setupTableScrollListeners();
// Globals for legacy (still needed until HTML is fully stripped)
window.fetchWeather = () => refreshWeather(true);
window.openTab = UI.openTab;
window.setBestRunRange = UI.setBestRunRange;
window.toggleForeSelection = UI.toggleForeSelection;
window.setPaceMode = UI.setPaceMode;
window.toggleForeSort = UI.toggleForeSort;
window.toggleClimateFilter = UI.toggleClimateFilter;
window.sortClimate = UI.sortClimate;
window.useGPS = UI.useGPS;
window.openLocationModal = UI.openLocationModal;
window.closeLocationModal = UI.closeLocationModal;
window.toggleVDOTDetails = UI.toggleVDOTDetails;
window.toggleImpactFilter = UI.toggleImpactFilter;
// handleCellHover etc needed?
// window.handleCellHover = UI.handleCellHover; // Not used inline anymore?
// window.moveForeTooltip = UI.moveForeTooltip;
// window.hideForeTooltip = UI.hideForeTooltip;
// window.handleChartHover = UI.handleChartHover;
// window.handleChartClick = UI.handleChartClick;
