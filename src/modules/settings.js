// Settings modal logic extracted from main.js init()
import { loadFromStorage, saveToStorage } from './storage.js';
import { AppState } from './appState.js';
import { AppStore, StoreActions } from './store.js';
import {
    formatEditableValue,
    heightUnit,
    toDisplayElevation,
    toDisplayHeight,
    toDisplayTemperature,
    toDisplayWeight,
    toDisplayWind,
    toMetricElevation,
    toMetricHeight,
    toMetricTemperature,
    toMetricWeight,
    toMetricWind,
    updateUnitLabels,
    weightUnit,
    elevationUnit
} from './units.js';

let lastSettingsFocus = null;

function restoreFocusOutsideModal(modal, preferredTarget, fallbackTarget) {
    if (!modal || !modal.contains(document.activeElement)) return;

    let focusTarget = null;
    if (preferredTarget && document.contains(preferredTarget)) {
        focusTarget = preferredTarget;
    } else if (fallbackTarget && document.contains(fallbackTarget)) {
        focusTarget = fallbackTarget;
    }

    if (focusTarget && typeof focusTarget.focus === 'function') {
        try {
            focusTarget.focus({ preventScroll: true });
        } catch {
            focusTarget.focus();
        }
        return;
    }

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
}

function getSelectedSystem(radios, fallback = 'metric') {
    for (const radio of radios) {
        if (radio.checked) return radio.value;
    }
    return fallback;
}

function setSelectedSystem(radios, system) {
    for (const radio of radios) {
        radio.checked = radio.value === system;
    }
}

function convertInputBetweenSystems(input, toMetricFn, toDisplayFn, fromSystem, toSystem, decimals = 1) {
    if (!input || fromSystem === toSystem) return;
    const raw = parseFloat(input.value);
    if (Number.isNaN(raw)) return;
    const metricVal = toMetricFn(raw, fromSystem);
    const converted = toDisplayFn(metricVal, toSystem);
    input.value = formatEditableValue(converted, decimals);
}

function syncSettingsUnitFields(system, refs) {
    const {
        weightInput,
        heightInput,
        altitudeInput,
        weightUnitEl,
        heightUnitEl,
        altitudeUnitEl
    } = refs;

    if (weightUnitEl) weightUnitEl.textContent = weightUnit(system);
    if (heightUnitEl) heightUnitEl.textContent = heightUnit(system);
    if (altitudeUnitEl) altitudeUnitEl.textContent = elevationUnit(system);

    if (weightInput) {
        weightInput.step = '0.5';
        weightInput.placeholder = system === 'imperial' ? '143' : '65';
        weightInput.min = system === 'imperial' ? '66' : '30';
        weightInput.max = system === 'imperial' ? '551' : '250';
    }

    if (heightInput) {
        heightInput.step = system === 'imperial' ? '0.5' : '1';
        heightInput.placeholder = system === 'imperial' ? '69' : '175';
        heightInput.min = system === 'imperial' ? '39' : '100';
        heightInput.max = system === 'imperial' ? '91' : '230';
    }

    if (altitudeInput) {
        altitudeInput.step = system === 'imperial' ? '300' : '100';
        altitudeInput.placeholder = system === 'imperial' ? '0' : '0';
    }
}

/**
 * Initialize the settings modal: open, close, save, and unit radio change handlers.
 * @param {object} els - Element references (must include btnSettings)
 * @param {function} updateFn - UI.update callback
 */
export function initSettings(els, updateFn) {
    const settingsModal = document.getElementById('settings-modal');
    if (!els.btnSettings || !settingsModal) return;

    const closeBtn = document.getElementById('close-settings');
    const saveBtn = document.getElementById('save-settings');
    const weightInput = document.getElementById('runner-weight');
    const heightInput = document.getElementById('runner-height');
    const ageInput = document.getElementById('runner-age');
    const genderInput = document.getElementById('runner-gender');
    const hrMaxInput = document.getElementById('runner-hr-max');
    const restingHrInput = document.getElementById('runner-resting-hr');
    const altitudeInput = document.getElementById('base-altitude');
    const weightUnitEl = document.getElementById('settings-weight-unit');
    const heightUnitEl = document.getElementById('settings-height-unit');
    const altitudeUnitEl = document.getElementById('settings-altitude-unit');
    const radios = document.getElementsByName('unit-system');

    const unitFieldRefs = {
        weightInput,
        heightInput,
        altitudeInput,
        weightUnitEl,
        heightUnitEl,
        altitudeUnitEl
    };

    let modalUnitSystem = AppState.unitSystem || 'metric';

    function closeSettings() {
        restoreFocusOutsideModal(settingsModal, lastSettingsFocus, els.btnSettings);
        settingsModal.classList.remove('open');
        settingsModal.style.removeProperty('display');
        settingsModal.setAttribute('aria-hidden', 'true');
        settingsModal.setAttribute('inert', '');
    }

    function openSettings() {
        lastSettingsFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const titleEl = settingsModal.querySelector('.modal-title');
        if (titleEl && !titleEl.id) titleEl.id = 'settings-modal-title';
        settingsModal.setAttribute('role', 'dialog');
        settingsModal.setAttribute('aria-modal', 'true');
        settingsModal.setAttribute('aria-hidden', 'false');
        settingsModal.removeAttribute('inert');
        if (titleEl) settingsModal.setAttribute('aria-labelledby', titleEl.id);

        modalUnitSystem = AppState.unitSystem || 'metric';
        setSelectedSystem(radios, modalUnitSystem);
        syncSettingsUnitFields(modalUnitSystem, unitFieldRefs);

        if (weightInput) {
            const val = toDisplayWeight(AppState.runner.weight || 65, modalUnitSystem);
            weightInput.value = formatEditableValue(val, 1);
        }

        if (heightInput) {
            if (AppState.runner.height != null) {
                const val = toDisplayHeight(AppState.runner.height, modalUnitSystem);
                const decimals = modalUnitSystem === 'imperial' ? 1 : 0;
                heightInput.value = formatEditableValue(val, decimals);
            } else {
                heightInput.value = '';
            }
        }

        if (ageInput) ageInput.value = AppState.runner.age || '';
        if (genderInput) genderInput.value = AppState.runner.gender || '';
        if (hrMaxInput) hrMaxInput.value = AppState.runner.hrMax || '';
        if (restingHrInput) restingHrInput.value = AppState.runner.restingHr || '';

        if (altitudeInput) {
            const val = toDisplayElevation(AppState.altitude.base || 0, modalUnitSystem);
            altitudeInput.value = formatEditableValue(val, 0);
        }

        settingsModal.classList.add('open');
        settingsModal.style.display = 'flex';
    }

    function saveSettings() {
        const previousSystem = AppState.unitSystem || 'metric';
        const newSystem = getSelectedSystem(radios, previousSystem);

        const enteredWeight = weightInput ? parseFloat(weightInput.value) : NaN;
        const weightKg = toMetricWeight(enteredWeight, newSystem);

        if (!Number.isFinite(weightKg) || weightKg <= 0) {
            alert('Please enter a valid weight.');
            return;
        }

        AppStore.dispatch(StoreActions.patchApp({ unitSystem: newSystem }));
        saveToStorage('unit_system', newSystem);

        const runnerPatch = { weight: weightKg };
        saveToStorage('runner_weight', weightKg);

        if (heightInput) {
            const enteredHeight = parseFloat(heightInput.value);
            if (Number.isFinite(enteredHeight) && enteredHeight > 0) {
                const heightCm = Math.round(toMetricHeight(enteredHeight, newSystem));
                runnerPatch.height = heightCm;
                saveToStorage('runner_height', heightCm);
            } else {
                runnerPatch.height = null;
                saveToStorage('runner_height', null);
            }
        }

        if (ageInput) {
            const age = parseInt(ageInput.value);
            if (Number.isFinite(age) && age > 0) {
                runnerPatch.age = age;
                saveToStorage('runner_age', age);
            } else {
                runnerPatch.age = null;
                saveToStorage('runner_age', null);
            }
        }

        if (genderInput) {
            const gender = genderInput.value;
            if (gender) {
                runnerPatch.gender = gender;
                saveToStorage('runner_gender', gender);
            } else {
                runnerPatch.gender = null;
                saveToStorage('runner_gender', null);
            }
        }

        const parsedHrMax = hrMaxInput ? parseInt(hrMaxInput.value, 10) : NaN;
        const parsedRestingHr = restingHrInput ? parseInt(restingHrInput.value, 10) : NaN;
        const hasHrMax = Number.isFinite(parsedHrMax) && parsedHrMax > 0;
        const hasRestingHr = Number.isFinite(parsedRestingHr) && parsedRestingHr > 0;

        if (hasHrMax && hasRestingHr && parsedRestingHr >= parsedHrMax) {
            alert('Resting HR must be lower than HR Max.');
            return;
        }

        if (hasHrMax) {
            runnerPatch.hrMax = parsedHrMax;
            saveToStorage('runner_hr_max', parsedHrMax);
        } else {
            runnerPatch.hrMax = null;
            saveToStorage('runner_hr_max', null);
        }

        if (hasRestingHr) {
            runnerPatch.restingHr = parsedRestingHr;
            saveToStorage('runner_resting_hr', parsedRestingHr);
        } else {
            runnerPatch.restingHr = null;
            saveToStorage('runner_resting_hr', null);
        }

        AppStore.dispatch(StoreActions.patchRunner(runnerPatch));

        if (altitudeInput) {
            const enteredAltitude = parseFloat(altitudeInput.value);
            const altMeters = Number.isFinite(enteredAltitude)
                ? Math.round(toMetricElevation(enteredAltitude, newSystem))
                : 0;
            AppStore.dispatch(StoreActions.patchAltitude({ base: altMeters }));
            saveToStorage('base_altitude', altMeters);
        }

        if (previousSystem !== newSystem) {
            convertInputBetweenSystems(els.temp, toMetricTemperature, toDisplayTemperature, previousSystem, newSystem, 1);
            convertInputBetweenSystems(els.dew, toMetricTemperature, toDisplayTemperature, previousSystem, newSystem, 1);
            convertInputBetweenSystems(els.wind, toMetricWind, toDisplayWind, previousSystem, newSystem, 1);
        }

        updateUnitLabels(newSystem);
        updateFn(els, AppState.hapCalc);

        document.dispatchEvent(new CustomEvent('runweather:unit-system-changed', {
            detail: {
                previousSystem,
                unitSystem: newSystem
            }
        }));

        closeSettings();
    }

    // Wire up event listeners
    els.btnSettings.addEventListener('click', openSettings);
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);

    // Click outside to close
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
    });

    settingsModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeSettings();
        }
    });

    // Dynamic input conversion while selecting units in modal.
    radios.forEach((radio) => {
        radio.addEventListener('change', () => {
            const nextSystem = getSelectedSystem(radios, modalUnitSystem);
            if (nextSystem === modalUnitSystem) return;

            convertInputBetweenSystems(weightInput, toMetricWeight, toDisplayWeight, modalUnitSystem, nextSystem, 1);
            convertInputBetweenSystems(heightInput, toMetricHeight, toDisplayHeight, modalUnitSystem, nextSystem, nextSystem === 'imperial' ? 1 : 0);
            convertInputBetweenSystems(altitudeInput, toMetricElevation, toDisplayElevation, modalUnitSystem, nextSystem, 0);

            modalUnitSystem = nextSystem;
            syncSettingsUnitFields(modalUnitSystem, unitFieldRefs);
        });
    });
}

/**
 * Load saved user settings (weight, age, gender, HR, altitude, units) from storage
 * and assign to AppState.
 */
export function loadSavedSettings() {
    const savedUnitSystem = loadFromStorage('unit_system');
    const unitSystem = savedUnitSystem || 'metric';

    AppStore.dispatch(StoreActions.patchApp({ unitSystem }));

    const savedWeight = loadFromStorage('runner_weight');
    const savedHeight = loadFromStorage('runner_height');
    const savedAge = loadFromStorage('runner_age');
    const savedGender = loadFromStorage('runner_gender');
    const savedHrMax = loadFromStorage('runner_hr_max');
    const savedRestingHr = loadFromStorage('runner_resting_hr');

    AppStore.dispatch(StoreActions.patchRunner({
        weight: savedWeight ? parseFloat(savedWeight) : 65,
        height: savedHeight ? parseInt(savedHeight) : null,
        age: savedAge ? parseInt(savedAge) : null,
        gender: savedGender || null,
        hrMax: savedHrMax ? parseInt(savedHrMax, 10) : null,
        restingHr: savedRestingHr ? parseInt(savedRestingHr, 10) : null
    }));

    const savedAltitude = loadFromStorage('base_altitude');
    AppStore.dispatch(StoreActions.patchAltitude({
        base: savedAltitude ? parseInt(savedAltitude) : 0
    }));

    updateUnitLabels(unitSystem);
}
