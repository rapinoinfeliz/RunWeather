// Electrolyte Calculator Logic
import {
    electrolyteSourceOptions,
    SWEAT_RATES,
    ELECTROLYTE_CONCENTRATIONS,
    CONVERSION_FACTORS,
    initialActiveElectrolytes,
    initialManualTargets
} from './constants.js';

const getSourceOptionData = (label) => {
    return electrolyteSourceOptions.find(opt => opt.label === label);
};

const getComponentData = (sourceOpt, componentName) => {
    return sourceOpt.components.find(c => c.name === componentName);
};

export function calculateElectrolyteData({
    hours,
    isSweatRate,
    sweatRate, // Index
    saltiness, // Index
    activeElectrolytes,
    electrolyteSources,
    manualTargets
}) {
    // 1. Calculate Target Amounts Per Hour
    const targetAmountsPerHour = {};
    const electrolytes = ['Sodium', 'Chloride', 'Potassium', 'Magnesium', 'Calcium'];

    electrolytes.forEach(electrolyte => {
        if (!isSweatRate) {
            targetAmountsPerHour[electrolyte] = manualTargets[electrolyte] || 0;
        } else if (!activeElectrolytes[electrolyte]) {
            targetAmountsPerHour[electrolyte] = 0;
        } else {
            const sweatRateValue = SWEAT_RATES[Math.min(Math.max(0, sweatRate), SWEAT_RATES.length - 1)];
            const concentration = ELECTROLYTE_CONCENTRATIONS[electrolyte][Math.min(Math.max(0, saltiness), ELECTROLYTE_CONCENTRATIONS[electrolyte].length - 1)];
            const mgPerL = concentration * CONVERSION_FACTORS[electrolyte];
            targetAmountsPerHour[electrolyte] = sweatRateValue * mgPerL;
        }
    });

    // 2. Helper: Calculate Weighted Absorption Rate
    const calculateWeightedAbsorptionRate = (electrolyte) => {
        let totalMg = 0;
        let weightedMg = 0;

        electrolyteSources.forEach(source => {
            source.components.forEach(comp => {
                if (comp.name === electrolyte && typeof comp.amount === 'number' && comp.amount > 0) {
                    totalMg += comp.amount;
                    weightedMg += comp.amount * comp.absorptionRate;
                }
            });
        });

        if (totalMg === 0) return 0;
        return weightedMg / totalMg;
    };

    // 3. Generate Analysis
    const electrolyteAnalysis = Object.entries(targetAmountsPerHour)
        .filter(([electrolyte]) => activeElectrolytes[electrolyte])
        .map(([electrolyte, targetPerHour]) => {
            const targetTotal = targetPerHour * hours;
            const absRate = calculateWeightedAbsorptionRate(electrolyte);

            const totalMgAdded = electrolyteSources.reduce((sum, source) => {
                const comp = source.components.find(c => c.name === electrolyte);
                return sum + (comp?.amount ?? 0);
            }, 0);

            const absorbedTotal = totalMgAdded * absRate;
            const diffAbsorbed = targetTotal - absorbedTotal;
            const percentage = targetTotal > 0 ? (absorbedTotal / targetTotal) * 100 : (absorbedTotal > 0 ? Infinity : 100);
            const hasAnySources = electrolyteSources.some(source =>
                source.components.some(comp => comp.name === electrolyte && typeof comp.amount === 'number' && comp.amount > 0)
            );

            let message = '';
            const tolerance = 1.0;

            if (!hasAnySources && targetTotal > tolerance) {
                message = `Need ${targetTotal.toFixed(1)}mg (absorbed), no sources added.`;
            } else if (targetTotal <= tolerance && absorbedTotal > tolerance) {
                message = `Target is ~0mg, but ${absorbedTotal.toFixed(1)}mg absorbed.`;
            } else if (hasAnySources || targetTotal > tolerance) {
                if (diffAbsorbed > tolerance) {
                    const additionalAbsorbedNeeded = diffAbsorbed;
                    if (absRate > 0) {
                        const additionalRawMgNeeded = additionalAbsorbedNeeded / absRate;
                        message = `Short by ${additionalAbsorbedNeeded.toFixed(1)}mg (absorbed). Need ~${additionalRawMgNeeded.toFixed(1)}mg raw.`;
                    } else {
                        message = `Short by ${additionalAbsorbedNeeded.toFixed(1)}mg (absorbed), no absorbable sources.`;
                    }
                } else if (diffAbsorbed < -tolerance) {
                    message = `Excess of ${Math.abs(diffAbsorbed).toFixed(1)}mg (absorbed).`;
                } else {
                    message = 'Target met.';
                }
            } else {
                message = 'Target is ~0mg, none added.';
            }

            return { electrolyte, percentage, message, absorbed: absorbedTotal, target: targetTotal, hasAnySources };
        });

    return { targetAmountsPerHour, electrolyteAnalysis };
}

export function autoCalculateElectrolytes({
    hours,
    activeElectrolytes,
    targetAmountsPerHour,
    activeSources // Current sources, though auto-calc mostly replaces them or calculates from scratch? The original sets new sources.
}) {
    if (hours <= 0) return [];

    const preferredSources = {
        Sodium: 'Sodium Chloride (Table Salt)',
        Potassium: 'Potassium Citrate',
        Chloride: 'Sodium Chloride (Table Salt)',
        Magnesium: 'Magnesium Citrate',
        Calcium: 'Calcium Citrate',
    };
    const calculationOrder = ['Sodium', 'Potassium', 'Magnesium', 'Calcium', 'Chloride'];

    const totalRawTargets = {};
    for (const key in targetAmountsPerHour) {
        totalRawTargets[key] = activeElectrolytes[key] ? targetAmountsPerHour[key] * hours : 0;
    }

    const remainingRawNeedsPass1 = { ...totalRawTargets };
    const sourcesToAdd = {};

    // Pass 1
    calculationOrder.forEach(electrolyte => {
        if (!activeElectrolytes[electrolyte] || remainingRawNeedsPass1[electrolyte] <= 0.01) return;

        const targetRawNeed = remainingRawNeedsPass1[electrolyte];
        const preferredSourceLabel = preferredSources[electrolyte];
        if (!preferredSourceLabel) return;

        const sourceOpt = getSourceOptionData(preferredSourceLabel);
        if (!sourceOpt) return;

        const targetComponent = getComponentData(sourceOpt, electrolyte);
        if (!targetComponent || targetComponent.ratio <= 0) return;

        const absorptionRate = targetComponent.absorptionRate;
        if (absorptionRate <= 0) return;

        const mgElectrolytePerMgSource = targetComponent.ratio;
        const effectiveMgAbsorbedPerMgSource = mgElectrolytePerMgSource * absorptionRate;

        // We calculate needed based on raw amount to match "absorbed"? 
        // Original logic: let sourceAmountNeeded = targetRawNeed / effectiveMgAbsorbedPerMgSource;
        // Wait, targetRawNeed in original was "targetAmountsPerHour[key] * hours".
        // And it says "totalRawTargets". 
        // But the formula uses effectiveMgAbsorbedPerMgSource which implies we are targeting Absorbed amount?
        // Let's check original logic carefully.
        // Original: const targets: ManualElectrolyteTargets = ... (calculated from sweat rate * concentration * conversion). 
        // Then: const totalRawTargets = (Object.keys(targetAmountsPerHour)... reduce ... targetAmountsPerHour[key] * hours
        // The "targetAmountsPerHour" from sweat rate is essentially "Mg Lost".
        // Absorption rates are usually 90-100%. 
        // If I lose 500mg Sodium, and absorption is 97.5%, strictly I need 500 / 0.975 = 512mg raw.
        // The original code: sourceAmountNeeded = targetRawNeed / effectiveMgAbsorbedPerMgSource;
        // This implies targetRawNeed IS the target absorbed amount (or loss amount).
        // Yes, so this logic is correct.

        let sourceAmountNeeded = targetRawNeed / effectiveMgAbsorbedPerMgSource;
        sourceAmountNeeded = Math.max(0, sourceAmountNeeded);

        if (sourceAmountNeeded > 0.01) {
            const alreadyAddedAmount = sourcesToAdd[preferredSourceLabel] || 0;
            const netAmountToAdd = Math.max(0, sourceAmountNeeded - alreadyAddedAmount);

            if (netAmountToAdd > 0.01) {
                sourcesToAdd[preferredSourceLabel] = alreadyAddedAmount + netAmountToAdd;

                sourceOpt.components.forEach(comp => {
                    const compName = comp.name;
                    if (activeElectrolytes[compName]) {
                        // We subtract the RAW amount provided from the remaining need.
                        // But wait, are we executing based on Raw or Absorbed?
                        // original: remainingRawNeedsPass1[compName] -= rawAmountProvided;
                        // where rawAmountProvided = netAmountToAdd * compRatio;
                        // This subtracts raw content.
                        // But we calculated sourceAmountNeeded based on Absorbed need.
                        // This seems slightly inconsistent in variable naming but functionally:
                        // "I need X amount. This source provides Y amount. Remaining need is X - Y."
                        // As long as we iterate, it should converge or be close enough.
                        const compRatio = comp.ratio;
                        const rawAmountProvided = netAmountToAdd * compRatio;
                        remainingRawNeedsPass1[compName] -= rawAmountProvided;
                    }
                });
            }
        }
    });

    // Pass 2 (Cleanup/Refinement)
    const remainingRawNeedsPass2 = { ...remainingRawNeedsPass1 };

    calculationOrder.forEach(electrolyte => {
        if (!activeElectrolytes[electrolyte] || remainingRawNeedsPass2[electrolyte] <= 0.01) return;

        const additionalRawNeed = remainingRawNeedsPass2[electrolyte];
        const preferredSourceLabel = preferredSources[electrolyte];
        if (!preferredSourceLabel) return;

        const sourceOpt = getSourceOptionData(preferredSourceLabel);
        if (!sourceOpt) return;

        const targetComponent = getComponentData(sourceOpt, electrolyte);
        if (!targetComponent || targetComponent.ratio <= 0) return;

        const absorptionRate = targetComponent.absorptionRate;
        if (absorptionRate <= 0) return;

        const mgElectrolytePerMgSource = targetComponent.ratio;
        const effectiveMgAbsorbedPerMgSource = mgElectrolytePerMgSource * absorptionRate;

        let additionalSourceAmount = additionalRawNeed / effectiveMgAbsorbedPerMgSource;

        let allowAddition = true;
        sourceOpt.components.forEach(comp => {
            const compName = comp.name;
            if (compName !== electrolyte && activeElectrolytes[compName]) {
                const compRatio = comp.ratio;
                if (compRatio > 0) {
                    const currentSecondaryNeed = remainingRawNeedsPass2[compName];
                    // Don't add if it causes significant excess elsewhere
                    if (currentSecondaryNeed < -1.0 && (additionalSourceAmount * compRatio > 0.01)) {
                        allowAddition = false;
                    }
                }
            }
        });

        if (!allowAddition) additionalSourceAmount = 0;
        additionalSourceAmount = Math.max(0, additionalSourceAmount);

        if (additionalSourceAmount > 0.01) {
            sourcesToAdd[preferredSourceLabel] = (sourcesToAdd[preferredSourceLabel] || 0) + additionalSourceAmount;

            sourceOpt.components.forEach(comp => {
                const compName = comp.name;
                if (activeElectrolytes[compName]) {
                    const compRatio = comp.ratio;
                    const rawAmountProvided = additionalSourceAmount * compRatio;
                    remainingRawNeedsPass2[compName] -= rawAmountProvided;
                }
            });
        }
    });

    // Format for return
    return Object.entries(sourcesToAdd)
        .filter(([_, amount]) => amount > 0.1)
        .map(([label, totalAmount]) => {
            const sourceOpt = getSourceOptionData(label);
            const calculatedComponents = sourceOpt.components.map(comp => ({
                name: comp.name,
                ratio: comp.ratio,
                absorptionRate: comp.absorptionRate,
                amount: parseFloat((comp.ratio * totalAmount).toFixed(1))
            }));
            return {
                source: label,
                amount: parseFloat(totalAmount.toFixed(1)),
                components: calculatedComponents
            };
        });
}
