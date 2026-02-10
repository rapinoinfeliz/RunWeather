// Settings modal logic extracted from main.js init()
import { loadFromStorage, saveToStorage } from './storage.js';

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
    const ageInput = document.getElementById('runner-age');
    const genderInput = document.getElementById('runner-gender');
    const altitudeInput = document.getElementById('base-altitude');
    const radios = document.getElementsByName('unit-system');

    function closeSettings() {
        settingsModal.classList.remove('open');
        settingsModal.style.removeProperty('display');
    }

    function openSettings() {
        // 1. Set Weight
        if (weightInput) {
            let val = window.runnerWeight || 65;
            if (window.unitSystem === 'imperial') {
                val = val * 2.20462;
                val = Math.round(val * 10) / 10;
            }
            weightInput.value = val;
        }

        // 2. Set Age/Gender
        if (ageInput) ageInput.value = window.runnerAge || '';
        if (genderInput) genderInput.value = window.runnerGender || '';

        // 3. Set Base Altitude
        if (altitudeInput) altitudeInput.value = window.baseAltitude || 0;

        // 4. Set Radio
        const currentSystem = window.unitSystem || 'metric';
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

        const systemChanged = newSystem !== window.unitSystem;
        window.unitSystem = newSystem;
        saveToStorage('unit_system', newSystem);

        // 2. Weight
        const val = parseFloat(weightInput.value);
        if (!isNaN(val) && val > 0) {
            let weightKg = val;
            if (newSystem === 'imperial') {
                weightKg = val / 2.20462;
            }

            window.runnerWeight = weightKg;
            saveToStorage('runner_weight', weightKg);

            // 3. Age & Gender
            if (ageInput) {
                const age = parseInt(ageInput.value);
                if (!isNaN(age) && age > 0) {
                    window.runnerAge = age;
                    saveToStorage('runner_age', age);
                } else {
                    window.runnerAge = null;
                    saveToStorage('runner_age', null);
                }
            }

            if (genderInput) {
                const gender = genderInput.value;
                if (gender) {
                    window.runnerGender = gender;
                    saveToStorage('runner_gender', gender);
                } else {
                    window.runnerGender = null;
                    saveToStorage('runner_gender', null);
                }
            }

            // 4. Base Altitude
            if (altitudeInput) {
                const alt = parseInt(altitudeInput.value) || 0;
                window.baseAltitude = alt;
                saveToStorage('base_altitude', alt);
            }

            updateFn(els, window.hapCalc);
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
 * and assign to window globals.
 */
export function loadSavedSettings() {
    // Unit System
    const savedUnitSystem = loadFromStorage('unit_system');
    window.unitSystem = savedUnitSystem || 'metric';

    // Weight
    const savedWeight = loadFromStorage('runner_weight');
    window.runnerWeight = savedWeight ? parseFloat(savedWeight) : 65;

    // Age & Gender
    const savedAge = loadFromStorage('runner_age');
    if (savedAge) window.runnerAge = parseInt(savedAge);

    const savedGender = loadFromStorage('runner_gender');
    if (savedGender) window.runnerGender = savedGender;

    // Base Altitude
    const savedAltitude = loadFromStorage('base_altitude');
    window.baseAltitude = savedAltitude ? parseInt(savedAltitude) : 0;
}
