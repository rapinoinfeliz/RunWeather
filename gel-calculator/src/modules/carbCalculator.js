// Carb Calculator Logic
import { sourceDataMap } from './constants.js';

/**
 * Calculates the required grams for each carb source based on targets and ratios.
 * @param {Object} params
 * @param {number} params.totalCarbsNeeded
 * @param {number} params.glucoseRatioSlider
 * @param {number} params.fructoseRatioSlider
 * @param {Array} params.glucoseSources
 * @param {Array} params.fructoseSources
 */
export function calculateCarbData({
    totalCarbsNeeded,
    glucoseRatioSlider,
    fructoseRatioSlider,
    glucoseSources,
    fructoseSources
}) {
    // 1. Validate Percentages
    const isGlucoseValid = glucoseSources.length === 0 || Math.abs(glucoseSources.reduce((acc, s) => acc + s.percentage, 0) - 100) < 0.01;
    const isFructoseValid = fructoseSources.length === 0 || Math.abs(fructoseSources.reduce((acc, s) => acc + s.percentage, 0) - 100) < 0.01;

    const finalGrams = { totalGrams: 0 };
    let glucoseAccountedByMixed = 0;
    let fructoseAccountedByMixed = 0;

    if (totalCarbsNeeded <= 0 || (glucoseRatioSlider + fructoseRatioSlider <= 0) || !isGlucoseValid || !isFructoseValid) {
        return {
            finalGrams,
            glucoseAccountedByMixed: 0,
            fructoseAccountedByMixed: 0,
            carbTotals: {
                targetGlucoseCarbs: 0,
                targetFructoseCarbs: 0,
                actualGlucoseCarbs: 0,
                actualFructoseCarbs: 0,
                canAchieveRatio: false,
                message: (!isGlucoseValid || !isFructoseValid) ? "Source percentages must sum to 100%." : ""
            }
        };
    }

    const totalRatioParts = glucoseRatioSlider + fructoseRatioSlider;
    const targetGlucoseCarbs = (glucoseRatioSlider / totalRatioParts) * totalCarbsNeeded;
    const targetFructoseCarbs = (fructoseRatioSlider / totalRatioParts) * totalCarbsNeeded;

    const tentativeMixedGrams = {};
    const allSelectedSources = [...glucoseSources, ...fructoseSources];
    const getSourceData = (sourceName) => sourceDataMap.get(sourceName);

    // 2. Calculate Mixed Sources contributions
    glucoseSources.forEach(source => {
        const data = getSourceData(source.source);
        if (data && data.glucoseContent > 0 && data.fructoseContent > 0 && source.percentage > 0) {
            const targetCarbs = targetGlucoseCarbs * (source.percentage / 100);
            const grams = (data.glucoseContent > 0 && data.carbsPerGram > 0)
                ? targetCarbs / (data.glucoseContent * data.carbsPerGram)
                : 0;
            tentativeMixedGrams[source.source] = grams;
        }
    });

    fructoseSources.forEach(source => {
        const data = getSourceData(source.source);
        if (data && data.glucoseContent > 0 && data.fructoseContent > 0 && source.percentage > 0) {
            const targetCarbs = targetFructoseCarbs * (source.percentage / 100);
            const grams = (data.fructoseContent > 0 && data.carbsPerGram > 0)
                ? targetCarbs / (data.fructoseContent * data.carbsPerGram)
                : 0;
            // Use maximum or sum? In the original logic, it overwrites if existing, essentially expecting user not to put same source in both unless it's handled.
            // Original logic: tentativeMixedGrams[source.source] = tentativeMixedGrams[source.source] ?? grams;
            // But wait, if a source provides both, it should be calculated primarily by one requirement or optimized.
            // The original logic sets it if not present.
            if (tentativeMixedGrams[source.source] === undefined) {
                tentativeMixedGrams[source.source] = grams;
            }
        }
    });

    // 3. Tally what mixed sources provided
    for (const sourceName in tentativeMixedGrams) {
        const grams = tentativeMixedGrams[sourceName];
        const data = getSourceData(sourceName);
        if (data && grams > 0) {
            glucoseAccountedByMixed += grams * data.glucoseContent * data.carbsPerGram;
            fructoseAccountedByMixed += grams * data.fructoseContent * data.carbsPerGram;
        }
    }

    const neededPureGlucoseCarbs = Math.max(0, targetGlucoseCarbs - glucoseAccountedByMixed);
    const neededPureFructoseCarbs = Math.max(0, targetFructoseCarbs - fructoseAccountedByMixed);

    // 4. Calculate Pure Glucose Sources
    const pureGlucoseSources = glucoseSources.filter(source => {
        const data = getSourceData(source.source);
        return data && data.glucoseContent > 0 && data.fructoseContent === 0;
    });
    const totalPureGlucosePercent = pureGlucoseSources.reduce((sum, s) => sum + s.percentage, 0);

    if (totalPureGlucosePercent > 0) {
        pureGlucoseSources.forEach(source => {
            const data = getSourceData(source.source);
            if (!data || data.carbsPerGram === 0 || data.glucoseContent === 0) {
                finalGrams[source.source] = 0; return;
            };
            const shareOfNeed = source.percentage / totalPureGlucosePercent;
            const targetCarbsForThisSource = neededPureGlucoseCarbs * shareOfNeed;
            const grams_pgi = (data.glucoseContent * data.carbsPerGram > 0)
                ? targetCarbsForThisSource / (data.glucoseContent * data.carbsPerGram)
                : 0;
            finalGrams[source.source] = grams_pgi;
        });
    }

    // 5. Calculate Pure Fructose Sources
    const pureFructoseSources = fructoseSources.filter(source => {
        const data = getSourceData(source.source);
        return data && data.fructoseContent > 0 && data.glucoseContent === 0;
    });
    const totalPureFructosePercent = pureFructoseSources.reduce((sum, s) => sum + s.percentage, 0);

    if (totalPureFructosePercent > 0) {
        pureFructoseSources.forEach(source => {
            const data = getSourceData(source.source);
            if (!data || data.carbsPerGram === 0 || data.fructoseContent === 0) {
                finalGrams[source.source] = 0; return;
            };
            const shareOfNeed = source.percentage / totalPureFructosePercent;
            const targetCarbsForThisSource = neededPureFructoseCarbs * shareOfNeed;
            const grams_pfj = (data.fructoseContent * data.carbsPerGram > 0)
                ? targetCarbsForThisSource / (data.fructoseContent * data.carbsPerGram)
                : 0;
            finalGrams[source.source] = grams_pfj;
        });
    }

    // 6. Merge Mixed Sources
    for (const sourceName in tentativeMixedGrams) {
        if (!(sourceName in finalGrams)) {
            finalGrams[sourceName] = tentativeMixedGrams[sourceName];
        }
    }

    // 7. Ensure all selected sources have an entry (even if 0)
    allSelectedSources.forEach(source => {
        if (source.source && !(source.source in finalGrams)) {
            finalGrams[source.source] = 0;
        }
    });

    // 8. Rounding
    for (const sourceName in finalGrams) {
        finalGrams[sourceName] = parseFloat(finalGrams[sourceName].toFixed(2));
    }

    finalGrams.totalGrams = Object.values(finalGrams).reduce((sum, grams) => {
        return typeof grams === 'number' ? sum + grams : sum;
    }, 0);

    // 9. Calculate Actual Totals for Feedback
    let actualGlucoseCarbs = 0;
    let actualFructoseCarbs = 0;

    for (const sourceName in finalGrams) {
        if (sourceName === 'totalGrams') continue;
        const grams = finalGrams[sourceName];
        const data = sourceDataMap.get(sourceName);
        if (data && typeof grams === 'number' && grams > 0) {
            actualGlucoseCarbs += grams * data.glucoseContent * data.carbsPerGram;
            actualFructoseCarbs += grams * data.fructoseContent * data.carbsPerGram;
        }
    }

    const totalActualCarbs = actualGlucoseCarbs + actualFructoseCarbs;
    const tolerance = Math.max(0.5, totalCarbsNeeded * 0.01);
    const glucoseDiff = Math.abs(actualGlucoseCarbs - targetGlucoseCarbs);
    const fructoseDiff = Math.abs(actualFructoseCarbs - targetFructoseCarbs);
    const totalDiff = Math.abs(totalActualCarbs - totalCarbsNeeded);

    let canAchieveRatio = true;
    let message = "";

    if (totalActualCarbs > 0.01 && (glucoseDiff > tolerance || fructoseDiff > tolerance || totalDiff > tolerance)) {
        canAchieveRatio = false;
        const actualRatioDisplay = actualFructoseCarbs > 0.01 ? (actualGlucoseCarbs / actualFructoseCarbs).toFixed(2) : "Inf";
        const targetRatioDisplay = targetFructoseCarbs > 0.01 ? (targetGlucoseCarbs / targetFructoseCarbs).toFixed(2) : "Inf";

        if (totalDiff > tolerance) {
            message = `Total carbs (${totalActualCarbs.toFixed(1)}g) differ from target (${totalCarbsNeeded.toFixed(1)}g). `;
        }
        if (glucoseDiff > tolerance || fructoseDiff > tolerance) {
            message += `Ratio (${actualRatioDisplay}:1) differs from target (${targetRatioDisplay}:1). `;

            const needsPureGlucose = targetGlucoseCarbs > glucoseAccountedByMixed + tolerance;
            const hasPureGlucoseSource = glucoseSources.some(s => { const d = getSourceData(s.source); return d && d.fructoseContent === 0 && s.percentage > 0; });
            const needsPureFructose = targetFructoseCarbs > fructoseAccountedByMixed + tolerance;
            const hasPureFructoseSource = fructoseSources.some(s => { const d = getSourceData(s.source); return d && d.glucoseContent === 0 && s.percentage > 0; });

            if (needsPureGlucose && !hasPureGlucoseSource && glucoseDiff > tolerance) {
                message += "Add a pure glucose source.";
            } else if (needsPureFructose && !hasPureFructoseSource && fructoseDiff > tolerance) {
                message += "Add a pure fructose source.";
            }
        }
    }

    return {
        finalGrams,
        glucoseAccountedByMixed,
        fructoseAccountedByMixed,
        carbTotals: {
            targetGlucoseCarbs,
            targetFructoseCarbs,
            actualGlucoseCarbs,
            actualFructoseCarbs,
            canAchieveRatio,
            message
        }
    };
}
