// Main Orchestration for Gel Calculator — Premium Edition
import {
    glucoseSourceOptions,
    fructoseSourceOptions,
    electrolyteSourceOptions,
    SWEAT_RATES,
    ELECTROLYTE_CONCENTRATIONS,
    CONVERSION_FACTORS,
    initialActiveElectrolytes,
    initialManualTargets,
    sourceDataMap
} from './modules/constants.js';

import { calculateCarbData } from './modules/carbCalculator.js';
import {
    calculateElectrolyteData,
    autoCalculateElectrolytes
} from './modules/electrolyteCalculator.js';

import { formatRecipeForCopy, formatInstructionsForCopy } from './modules/recipeFormatter.js';
import { loadState, saveState } from './modules/storage.js';

import {
    populateSweatRateSelect,
    populateSaltinessSelect,
    renderManualTargetInputs,
    renderElectrolyteGrid,
    renderCarbSourceRows,
    renderElectrolyteSourceRows,
    renderElectrolyteAnalysis,
    renderRecipe,
    renderRecipeModal,
    updateHoursDisplays,
    updateRatioBadges,
    updateRatioVisual,
    updateStats,
    updateTargetCarbs,
    showCarbErrors,
    showToast,
    setupTooltips
} from './modules/ui.js';

// ── State ──
const saved = loadState();

const defaultState = {
    hours: 1,
    carbsPerHour: 90,
    glucoseRatioSlider: 100,
    fructoseRatioSlider: 80,
    glucoseSources: [],
    fructoseSources: [],
    isBatchMode: true,
    gelsPerHour: 3,
    isSweatRate: true,
    sweatRate: 0,
    saltiness: 0,
    activeElectrolytes: { ...initialActiveElectrolytes },
    electrolyteSources: [],
    manualTargets: { ...initialManualTargets },
};

const state = {
    hours: saved?.hours ?? defaultState.hours,
    carbsPerHour: saved?.carbsPerHour ?? defaultState.carbsPerHour,
    glucoseRatioSlider: saved?.glucoseRatioSlider ?? defaultState.glucoseRatioSlider,
    fructoseRatioSlider: saved?.fructoseRatioSlider ?? defaultState.fructoseRatioSlider,
    glucoseSources: saved?.glucoseSources ?? [...defaultState.glucoseSources],
    fructoseSources: saved?.fructoseSources ?? [...defaultState.fructoseSources],
    isBatchMode: saved?.isBatchMode ?? defaultState.isBatchMode,
    gelsPerHour: saved?.gelsPerHour ?? defaultState.gelsPerHour,
    isSweatRate: saved?.isSweatRate ?? defaultState.isSweatRate,
    sweatRate: saved?.sweatRate ?? defaultState.sweatRate,
    saltiness: saved?.saltiness ?? defaultState.saltiness,
    activeElectrolytes: saved?.activeElectrolytes ?? { ...defaultState.activeElectrolytes },
    electrolyteSources: saved?.electrolyteSources ?? [...defaultState.electrolyteSources],
    manualTargets: saved?.manualTargets ?? { ...defaultState.manualTargets },
};

// ── Derived calculations ──

function getTotalCarbsNeeded() {
    return state.carbsPerHour * state.hours;
}

function computeTargetAmountsPerHour() {
    const targets = { Sodium: 0, Chloride: 0, Potassium: 0, Magnesium: 0, Calcium: 0 };
    for (const elec of Object.keys(targets)) {
        if (!state.isSweatRate) {
            targets[elec] = state.manualTargets[elec] || 0;
        } else {
            if (!state.activeElectrolytes[elec]) { targets[elec] = 0; continue; }
            const sweatRateValue = SWEAT_RATES[Math.min(Math.max(0, state.sweatRate), SWEAT_RATES.length - 1)];
            const conc = ELECTROLYTE_CONCENTRATIONS[elec][Math.min(Math.max(0, state.saltiness), ELECTROLYTE_CONCENTRATIONS[elec].length - 1)];
            const mgPerL = conc * CONVERSION_FACTORS[elec];
            targets[elec] = sweatRateValue * mgPerL;
        }
    }
    return targets;
}

function calculateTotalContribution(electrolyte) {
    const totalAbsorbedDuration = state.electrolyteSources.reduce((total, source) => {
        const comp = source.components.find(c => c.name === electrolyte);
        if (comp && typeof comp.amount === 'number') {
            return total + (comp.amount * comp.absorptionRate);
        }
        return total;
    }, 0);
    return state.hours > 0 ? totalAbsorbedDuration / state.hours : 0;
}

function calculateWeightedAbsorptionRate(electrolyte) {
    let totalMg = 0;
    let weightedMg = 0;
    state.electrolyteSources.forEach(source => {
        source.components.forEach(comp => {
            if (comp.name === electrolyte && typeof comp.amount === 'number' && comp.amount > 0) {
                totalMg += comp.amount;
                weightedMg += comp.amount * comp.absorptionRate;
            }
        });
    });
    return totalMg === 0 ? 0 : weightedMg / totalMg;
}

function computeElectrolyteAnalysis(targetAmountsPerHour) {
    return Object.entries(targetAmountsPerHour)
        .filter(([elec]) => state.activeElectrolytes[elec])
        .map(([electrolyte, targetPerHour]) => {
            const targetTotal = targetPerHour * state.hours;
            const absRate = calculateWeightedAbsorptionRate(electrolyte);
            const totalMgAdded = state.electrolyteSources.reduce((sum, source) => {
                const comp = source.components.find(c => c.name === electrolyte);
                return sum + (comp?.amount ?? 0);
            }, 0);
            const absorbedTotal = totalMgAdded * absRate;
            const diffAbsorbed = targetTotal - absorbedTotal;
            const percentage = targetTotal > 0 ? (absorbedTotal / targetTotal) * 100 : (absorbedTotal > 0 ? Infinity : 100);
            const hasAnySources = state.electrolyteSources.some(source =>
                source.components.some(comp => comp.name === electrolyte && typeof comp.amount === 'number' && comp.amount > 0)
            );
            let message = '';
            const tolerance = 1.0;

            if (!hasAnySources && targetTotal > tolerance) {
                message = `Need ${targetTotal.toFixed(1)}mg (absorbed), no sources added.`;
            } else if (targetTotal <= tolerance && absorbedTotal > tolerance) {
                message = `Target is ~0mg, but ${absorbedTotal.toFixed(1)}mg absorbed from sources.`;
            } else if (hasAnySources || targetTotal > tolerance) {
                if (diffAbsorbed > tolerance) {
                    const additionalAbsorbedNeeded = diffAbsorbed;
                    if (absRate > 0) {
                        const additionalRawMgNeeded = additionalAbsorbedNeeded / absRate;
                        message = `Short by ${additionalAbsorbedNeeded.toFixed(1)}mg (absorbed). Need ~${additionalRawMgNeeded.toFixed(1)}mg more raw ${electrolyte} (avg. ${(absRate * 100).toFixed(0)}% abs.).`;
                    } else {
                        message = `Short by ${additionalAbsorbedNeeded.toFixed(1)}mg (absorbed), but no current sources provide absorbable ${electrolyte}.`;
                    }
                } else if (diffAbsorbed < -tolerance) {
                    message = `Excess of ${Math.abs(diffAbsorbed).toFixed(1)}mg (absorbed).`;
                } else {
                    message = 'Target met (absorbed).';
                }
            } else {
                message = 'Target is ~0mg, none added.';
            }

            return { electrolyte, percentage, message, absorbed: absorbedTotal, target: targetTotal, hasAnySources };
        });
}

// ── Carb Calculations ──

function computeCarbs() {
    const totalCarbsNeeded = getTotalCarbsNeeded();
    const result = calculateCarbData({
        totalCarbsNeeded,
        glucoseRatioSlider: state.glucoseRatioSlider,
        fructoseRatioSlider: state.fructoseRatioSlider,
        glucoseSources: state.glucoseSources,
        fructoseSources: state.fructoseSources,
    });
    return {
        calculatedCarbData: {
            finalGrams: result.finalGrams,
            glucoseAccountedByMixed: result.glucoseAccountedByMixed,
            fructoseAccountedByMixed: result.fructoseAccountedByMixed,
        },
        carbTotals: result.carbTotals,
    };
}

// ── Percentage Validation ──

function isPctValid(sources) {
    if (sources.length === 0) return true;
    const sum = sources.reduce((acc, s) => acc + s.percentage, 0);
    return Math.abs(sum - 100) < 0.01;
}

// ── Full UI Refresh ──

function refresh() {
    const totalCarbsNeeded = getTotalCarbsNeeded();
    const isGlucosePctValid = isPctValid(state.glucoseSources);
    const isFructosePctValid = isPctValid(state.fructoseSources);

    // Carbs
    const carbResult = computeCarbs();
    const calculatedCarbData = carbResult.calculatedCarbData;
    const carbTotals = carbResult.carbTotals;

    // UI: basic displays
    updateRatioBadges(state.glucoseRatioSlider, state.fructoseRatioSlider);
    updateRatioVisual(state.glucoseRatioSlider, state.fructoseRatioSlider);
    updateTargetCarbs(carbTotals.targetGlucoseCarbs, carbTotals.targetFructoseCarbs);
    updateHoursDisplays(state.hours);

    // Stats (total carbs, calories, weight)
    const totalWeight = calculatedCarbData.finalGrams.totalGrams || 0;
    updateStats(totalCarbsNeeded, totalWeight);

    // Carb source tables
    const getSourceGrams = (name) => {
        if (!isGlucosePctValid || !isFructosePctValid) return 0;
        return calculatedCarbData.finalGrams[name] || 0;
    };

    renderCarbSourceRows('glucose', state.glucoseSources, glucoseSourceOptions, getSourceGrams, isGlucosePctValid);
    renderCarbSourceRows('fructose', state.fructoseSources, fructoseSourceOptions, getSourceGrams, isFructosePctValid);
    showCarbErrors(carbTotals, isGlucosePctValid, isFructosePctValid);

    // Electrolytes
    const targetAmountsPerHour = computeTargetAmountsPerHour();
    const electrolyteAnalysis = computeElectrolyteAnalysis(targetAmountsPerHour);

    renderElectrolyteGrid(targetAmountsPerHour, state.activeElectrolytes, state.hours, calculateTotalContribution);
    renderElectrolyteSourceRows(state.electrolyteSources);
    renderElectrolyteAnalysis(electrolyteAnalysis);

    // Recipe
    renderRecipe(calculatedCarbData, carbTotals, state.electrolyteSources, state.isBatchMode, state.hours, state.gelsPerHour);

    // Batch mode UI
    const gelsGroup = document.getElementById('gels-per-hour-group');
    gelsGroup.style.display = state.isBatchMode ? 'none' : 'flex';
    if (!state.isBatchMode) {
        document.getElementById('total-gels-label').textContent = `gels/h (${state.gelsPerHour * state.hours} total)`;
    }

    // Save
    saveState(state);
}

// ── Event Setup ──

function init() {
    // Populate dropdowns
    populateSweatRateSelect();
    populateSaltinessSelect();
    setupTooltips();

    // Set initial values from state
    document.getElementById('hours').value = state.hours;
    document.getElementById('carbs-per-hour').value = state.carbsPerHour;
    document.getElementById('glucose-ratio-slider').value = state.glucoseRatioSlider;
    document.getElementById('fructose-ratio-slider').value = state.fructoseRatioSlider;
    document.getElementById('sweat-rate-select').value = state.sweatRate;
    document.getElementById('saltiness-select').value = state.saltiness;
    document.getElementById('gels-per-hour').value = state.gelsPerHour;

    // Sweat mode tabs
    const sweatTabs = document.getElementById('sweat-mode-tabs');
    if (!state.isSweatRate) {
        sweatTabs.querySelector('[data-value="sweat-rate"]').classList.remove('active');
        sweatTabs.querySelector('[data-value="manual"]').classList.add('active');
        document.getElementById('elec-auto-inputs').style.display = 'none';
        document.getElementById('elec-manual-inputs').style.display = 'block';
    }
    renderManualTargetInputs(state.manualTargets);

    // Batch mode tabs
    const batchTabs = document.getElementById('batch-mode-tabs');
    if (!state.isBatchMode) {
        batchTabs.querySelector('[data-value="batch"]').classList.remove('active');
        batchTabs.querySelector('[data-value="gel"]').classList.add('active');
    }

    // ── Basic input events ──
    document.getElementById('hours').addEventListener('input', e => {
        state.hours = Math.max(0.1, parseFloat(e.target.value) || 0.1);
        refresh();
    });
    document.getElementById('carbs-per-hour').addEventListener('input', e => {
        state.carbsPerHour = Math.max(0, parseFloat(e.target.value) || 0);
        refresh();
    });

    // ── Ratio sliders ──
    document.getElementById('glucose-ratio-slider').addEventListener('input', e => {
        state.glucoseRatioSlider = parseInt(e.target.value);
        refresh();
    });
    document.getElementById('fructose-ratio-slider').addEventListener('input', e => {
        state.fructoseRatioSlider = parseInt(e.target.value);
        refresh();
    });

    // ── Add source buttons ──
    document.getElementById('add-glucose-btn').addEventListener('click', () => {
        state.glucoseSources.push({ source: '', carbsPerGram: 0, percentage: state.glucoseSources.length === 0 ? 100 : 0 });
        refresh();
    });
    document.getElementById('add-fructose-btn').addEventListener('click', () => {
        state.fructoseSources.push({ source: '', carbsPerGram: 0, percentage: state.fructoseSources.length === 0 ? 100 : 0 });
        refresh();
    });
    document.getElementById('add-elec-btn').addEventListener('click', () => {
        state.electrolyteSources.push({ source: '', amount: 0, components: [] });
        refresh();
    });

    // ── Delegated events for source tables ──
    document.addEventListener('change', e => {
        // Carb source select
        if (e.target.matches('select[data-type="glucose"], select[data-type="fructose"]')) {
            const type = e.target.dataset.type;
            const index = parseInt(e.target.dataset.index);
            const value = e.target.value;
            const options = type === 'glucose' ? glucoseSourceOptions : fructoseSourceOptions;
            const selected = options.find(o => o.label === value);
            const sources = type === 'glucose' ? state.glucoseSources : state.fructoseSources;
            if (selected) {
                sources[index] = { ...sources[index], source: selected.label, carbsPerGram: selected.carbsPerGram };
            } else {
                sources[index] = { ...sources[index], source: '', carbsPerGram: 0 };
            }
            refresh();
        }
        // Electrolyte source select
        if (e.target.matches('select[data-type="electrolyte"]')) {
            const index = parseInt(e.target.dataset.index);
            const value = e.target.value;
            const selected = electrolyteSourceOptions.find(o => o.label === value);
            const currentAmount = state.electrolyteSources[index]?.amount || 0;
            if (selected) {
                state.electrolyteSources[index] = {
                    source: selected.label,
                    amount: currentAmount,
                    components: selected.components.map(c => ({
                        name: c.name,
                        ratio: c.ratio,
                        absorptionRate: c.absorptionRate,
                        amount: parseFloat((c.ratio * currentAmount).toFixed(1))
                    }))
                };
            } else {
                state.electrolyteSources[index] = { source: '', amount: 0, components: [] };
            }
            refresh();
        }
    });

    document.addEventListener('input', e => {
        // Percentage inputs
        if (e.target.matches('.pct-input')) {
            const type = e.target.dataset.type;
            const index = parseInt(e.target.dataset.index);
            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
            const sources = type === 'glucose' ? state.glucoseSources : state.fructoseSources;
            sources[index].percentage = val;
            refresh();
        }
        // Electrolyte amount inputs
        if (e.target.matches('.amt-input')) {
            const index = parseInt(e.target.dataset.index);
            const val = Math.max(0, parseFloat(e.target.value) || 0);
            const source = state.electrolyteSources[index];
            source.amount = val;
            source.components = source.components.map(c => ({
                ...c,
                amount: parseFloat((c.ratio * val).toFixed(1))
            }));
            refresh();
        }
        // Manual target inputs
        if (e.target.matches('.manual-target-input')) {
            const elec = e.target.dataset.elec;
            state.manualTargets[elec] = Math.max(0, parseFloat(e.target.value) || 0);
            refresh();
        }
    });

    // ── Remove buttons (delegated) ──
    document.addEventListener('click', e => {
        const removeBtn = e.target.closest('.btn-remove');
        if (removeBtn) {
            const type = removeBtn.dataset.type;
            const index = parseInt(removeBtn.dataset.index);
            if (type === 'electrolyte') {
                state.electrolyteSources = state.electrolyteSources.filter((_, i) => i !== index);
            } else {
                const sources = type === 'glucose' ? state.glucoseSources : state.fructoseSources;
                const newSources = sources.filter((_, i) => i !== index);
                if (newSources.length === 1) {
                    const sum = newSources.reduce((acc, s) => acc + s.percentage, 0);
                    if (Math.abs(sum - 100) > 0.01) {
                        newSources[0].percentage = 100;
                    }
                }
                if (type === 'glucose') state.glucoseSources = newSources;
                else state.fructoseSources = newSources;
            }
            refresh();
        }

        // Electrolyte grid clicks
        const gridItem = e.target.closest('.elec-grid-item');
        if (gridItem) {
            const elec = gridItem.dataset.elec;
            state.activeElectrolytes[elec] = !state.activeElectrolytes[elec];
            refresh();
        }
    });

    // ── Sweat mode tabs ──
    sweatTabs.addEventListener('click', e => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        const value = btn.dataset.value;
        sweatTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.isSweatRate = value === 'sweat-rate';
        document.getElementById('elec-auto-inputs').style.display = state.isSweatRate ? 'grid' : 'none';
        document.getElementById('elec-manual-inputs').style.display = state.isSweatRate ? 'none' : 'block';
        if (!state.isSweatRate) renderManualTargetInputs(state.manualTargets);
        refresh();
    });

    // ── Batch mode tabs ──
    batchTabs.addEventListener('click', e => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        const value = btn.dataset.value;
        batchTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.isBatchMode = value === 'batch';
        refresh();
    });

    // ── Sweat rate / saltiness ──
    document.getElementById('sweat-rate-select').addEventListener('change', e => {
        state.sweatRate = parseInt(e.target.value);
        refresh();
    });
    document.getElementById('saltiness-select').addEventListener('change', e => {
        state.saltiness = parseInt(e.target.value);
        refresh();
    });

    // ── Gels per hour ──
    document.getElementById('gels-per-hour').addEventListener('input', e => {
        state.gelsPerHour = Math.max(1, parseInt(e.target.value) || 1);
        refresh();
    });

    // ── Auto-Calculate Electrolytes ──
    document.getElementById('auto-calc-elec-btn').addEventListener('click', () => {
        const targetAmountsPerHour = computeTargetAmountsPerHour();
        const result = autoCalculateElectrolytes({
            hours: state.hours,
            activeElectrolytes: state.activeElectrolytes,
            targetAmountsPerHour,
            activeSources: state.electrolyteSources
        });
        state.electrolyteSources = result;
        refresh();
        showToast('Electrolytes auto-calculated');
    });

    // ── Copy Recipe ──
    document.getElementById('copy-recipe-btn').addEventListener('click', () => {
        const carbResult = computeCarbs();
        const text = formatRecipeForCopy(
            carbResult.calculatedCarbData,
            state.electrolyteSources,
            state.isBatchMode,
            state.hours,
            state.gelsPerHour
        );
        navigator.clipboard.writeText(text).then(() => {
            showToast('Recipe copied');
        });
    });

    // ── View Instructions Modal ──
    document.getElementById('view-instructions-btn').addEventListener('click', () => {
        const carbResult = computeCarbs();
        renderRecipeModal(carbResult.calculatedCarbData, state.electrolyteSources, state.isBatchMode, state.hours, state.gelsPerHour);
        document.getElementById('recipe-modal-overlay').style.display = 'flex';
    });

    // ── Close Modal ──
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('recipe-modal-overlay').style.display = 'none';
    });
    document.getElementById('recipe-modal-overlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) {
            document.getElementById('recipe-modal-overlay').style.display = 'none';
        }
    });

    // ── Copy Instructions ──
    document.getElementById('copy-instructions-btn').addEventListener('click', () => {
        const carbResult = computeCarbs();
        const totalGels = state.gelsPerHour * state.hours;
        const divisor = state.isBatchMode ? 1 : (totalGels > 0 ? totalGels : 1);

        const carbEntries = Object.entries(carbResult.calculatedCarbData.finalGrams)
            .filter(([key, val]) => key !== 'totalGrams' && typeof val === 'number' && val > 0.01);

        const carbIngredients = carbEntries.map(([name, g]) => ({ name, amount: g, unit: 'g' }));
        const electrolyteIngredients = state.electrolyteSources
            .filter(s => s.source && s.amount > 0.01)
            .map(s => ({ name: s.source, amount: s.amount, unit: 'mg' }));

        const glucoseBasedCarbs = [];
        const fructoseBasedCarbs = [];

        for (const [name, totalG] of carbEntries) {
            const item = { name, amount: totalG, unit: 'g' };
            const isFructoseOption = fructoseSourceOptions.some(o => o.label === name);
            if (isFructoseOption) {
                fructoseBasedCarbs.push(item);
            } else {
                glucoseBasedCarbs.push(item);
            }
        }

        const totalCarbs = carbResult.calculatedCarbData.finalGrams.totalGrams || 0;
        const text = formatInstructionsForCopy(
            carbIngredients,
            electrolyteIngredients,
            glucoseBasedCarbs,
            fructoseBasedCarbs,
            totalCarbs,
            state.isBatchMode,
            state.hours,
            state.gelsPerHour
        );
        navigator.clipboard.writeText(text).then(() => {
            showToast('Instructions copied');
        });
    });

    // ── Reset to Defaults ──
    document.getElementById('reset-btn').addEventListener('click', () => {
        Object.assign(state, {
            hours: defaultState.hours,
            carbsPerHour: defaultState.carbsPerHour,
            glucoseRatioSlider: defaultState.glucoseRatioSlider,
            fructoseRatioSlider: defaultState.fructoseRatioSlider,
            glucoseSources: [],
            fructoseSources: [],
            isBatchMode: defaultState.isBatchMode,
            gelsPerHour: defaultState.gelsPerHour,
            isSweatRate: defaultState.isSweatRate,
            sweatRate: defaultState.sweatRate,
            saltiness: defaultState.saltiness,
            activeElectrolytes: { ...defaultState.activeElectrolytes },
            electrolyteSources: [],
            manualTargets: { ...defaultState.manualTargets },
        });

        // Reset UI inputs
        document.getElementById('hours').value = state.hours;
        document.getElementById('carbs-per-hour').value = state.carbsPerHour;
        document.getElementById('glucose-ratio-slider').value = state.glucoseRatioSlider;
        document.getElementById('fructose-ratio-slider').value = state.fructoseRatioSlider;
        document.getElementById('sweat-rate-select').value = state.sweatRate;
        document.getElementById('saltiness-select').value = state.saltiness;
        document.getElementById('gels-per-hour').value = state.gelsPerHour;

        // Reset tabs
        const sweatTabBtns = document.getElementById('sweat-mode-tabs');
        sweatTabBtns.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        sweatTabBtns.querySelector('[data-value="sweat-rate"]').classList.add('active');
        document.getElementById('elec-auto-inputs').style.display = 'grid';
        document.getElementById('elec-manual-inputs').style.display = 'none';

        const batchTabBtns = document.getElementById('batch-mode-tabs');
        batchTabBtns.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        batchTabBtns.querySelector('[data-value="batch"]').classList.add('active');

        renderManualTargetInputs(state.manualTargets);
        refresh();
        showToast('Reset to defaults');
    });

    // Initial render
    refresh();
}

document.addEventListener('DOMContentLoaded', init);
