// Settings modal logic extracted from main.js init()
import { loadFromStorage, saveToStorage } from './storage.js';
import { AppState } from './appState.js';
import { AppStore, StoreActions } from './store.js';

let lastSettingsFocus = null;

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
    const altitudeInput = document.getElementById('base-altitude');
    const radios = document.getElementsByName('unit-system');

    function closeSettings() {
        settingsModal.classList.remove('open');
        settingsModal.style.removeProperty('display');
        settingsModal.setAttribute('aria-hidden', 'true');
        if (lastSettingsFocus && typeof lastSettingsFocus.focus === 'function') {
            requestAnimationFrame(() => lastSettingsFocus.focus());
        }
    }

    function openSettings() {
        lastSettingsFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const titleEl = settingsModal.querySelector('.modal-title');
        if (titleEl && !titleEl.id) titleEl.id = 'settings-modal-title';
        settingsModal.setAttribute('role', 'dialog');
        settingsModal.setAttribute('aria-modal', 'true');
        settingsModal.setAttribute('aria-hidden', 'false');
        if (titleEl) settingsModal.setAttribute('aria-labelledby', titleEl.id);
        // 1. Set Weight
        if (weightInput) {
            let val = AppState.runner.weight || 65;
            if (AppState.unitSystem === 'imperial') {
                val = val * 2.20462;
                val = Math.round(val * 10) / 10;
            }
            weightInput.value = val;
        }

        // 1b. Set Height
        if (heightInput) {
            heightInput.value = AppState.runner.height || '';
        }

        // 2. Set Age/Gender
        if (ageInput) ageInput.value = AppState.runner.age || '';
        if (genderInput) genderInput.value = AppState.runner.gender || '';

        // 3. Set Base Altitude
        if (altitudeInput) altitudeInput.value = AppState.altitude.base || 0;

        // 4. Set Radio
        const currentSystem = AppState.unitSystem || 'metric';
        for (const radio of radios) {
            if (radio.value === currentSystem) radio.checked = true;
        }

        settingsModal.classList.add('open');
        settingsModal.style.display = 'flex';
    }

    function saveSettings() {
        // 1. Unit System
        let newSystem = 'metric';
        for (const radio of radios) {
            if (radio.checked) newSystem = radio.value;
        }

        AppStore.dispatch(StoreActions.patchApp({ unitSystem: newSystem }));
        saveToStorage('unit_system', newSystem);

        // 2. Weight
        const val = parseFloat(weightInput.value);
        if (!isNaN(val) && val > 0) {
            let weightKg = val;
            if (newSystem === 'imperial') {
                weightKg = val / 2.20462;
            }

            const runnerPatch = { weight: weightKg };
            saveToStorage('runner_weight', weightKg);

            // 2b. Height
            if (heightInput) {
                const h = parseInt(heightInput.value);
                if (!isNaN(h) && h > 0) {
                    runnerPatch.height = h;
                    saveToStorage('runner_height', h);
                } else {
                    runnerPatch.height = null;
                    saveToStorage('runner_height', null);
                }
            }

            // 3. Age & Gender
            if (ageInput) {
                const age = parseInt(ageInput.value);
                if (!isNaN(age) && age > 0) {
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
            AppStore.dispatch(StoreActions.patchRunner(runnerPatch));

            // 4. Base Altitude
            if (altitudeInput) {
                const alt = parseInt(altitudeInput.value) || 0;
                AppStore.dispatch(StoreActions.patchAltitude({ base: alt }));
                saveToStorage('base_altitude', alt);
            }

            updateFn(els, AppState.hapCalc);
            closeSettings();
        } else {
            alert("Please enter a valid weight.");
        }
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

/**
 * Load saved user settings (weight, age, gender, altitude, units) from storage
 * and assign to AppState.
 */
export function loadSavedSettings() {
    // Unit System
    const savedUnitSystem = loadFromStorage('unit_system');
    AppStore.dispatch(StoreActions.patchApp({
        unitSystem: savedUnitSystem || 'metric'
    }));

    // Weight
    const savedWeight = loadFromStorage('runner_weight');
    const savedHeight = loadFromStorage('runner_height');
    const savedAge = loadFromStorage('runner_age');
    const savedGender = loadFromStorage('runner_gender');
    AppStore.dispatch(StoreActions.patchRunner({
        weight: savedWeight ? parseFloat(savedWeight) : 65,
        height: savedHeight ? parseInt(savedHeight) : null,
        age: savedAge ? parseInt(savedAge) : null,
        gender: savedGender || null
    }));

    // Base Altitude
    const savedAltitude = loadFromStorage('base_altitude');
    AppStore.dispatch(StoreActions.patchAltitude({
        base: savedAltitude ? parseInt(savedAltitude) : 0
    }));
}
