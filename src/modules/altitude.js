/**
 * Altitude Impact Calculator
 * Uses Wehrlin & Hallén (2006) model - most accurate for moderate altitudes
 * 
 * Reference:
 * Wehrlin JP, Hallén J. "Linear decrease in VO2max and performance with 
 * increasing altitude in endurance athletes." Eur J Appl Physiol. 2006;96(4):404-12.
 */

/**
 * Calculate % of Sea-Level VO2max at given altitude
 * Using Wehrlin & Hallén (2006) exponential model
 * 
 * @param {number} altitude - Altitude in meters
 * @returns {number} Percentage of sea-level VO2max (0-100)
 */
export function getVO2maxPercentage(altitude) {
    const alt = Math.max(0, altitude);
    const exponent = -0.000115 * Math.pow(alt, 0.9446);
    const vo2Percentage = 100 * Math.exp(exponent);

    return Math.max(50, Math.min(100, vo2Percentage));
}

/**
 * Calculate the altitude-based pace impact
 * 
 * @param {number} baseAlt - Altitude the runner is acclimated to (meters)
 * @param {number} targetAlt - Altitude where the runner will race (meters)
 * @returns {object} Impact details
 */
export function getAltitudeImpact(baseAlt, targetAlt) {
    const baseVO2 = getVO2maxPercentage(baseAlt);
    const targetVO2 = getVO2maxPercentage(targetAlt);

    // Relative VO2max at target altitude compared to base
    const relativeVO2 = (targetVO2 / baseVO2) * 100;
    const vo2Drop = 100 - relativeVO2;

    // Pace correction factor (inverse of VO2 ratio)
    const paceCorrectionFactor = baseVO2 / targetVO2;
    const paceImpactPct = (paceCorrectionFactor - 1) * 100;

    return {
        impactPct: parseFloat(paceImpactPct.toFixed(2)),
        correctionFactor: parseFloat(paceCorrectionFactor.toFixed(4)),
        deltaAlt: targetAlt - baseAlt,
        baseVO2: parseFloat(baseVO2.toFixed(2)),
        targetVO2: parseFloat(targetVO2.toFixed(2)),
        vo2Drop: parseFloat(vo2Drop.toFixed(2))
    };
}

/**
 * Calculate pace adjusted for altitude
 * Uses Wehrlin & Hallén (2006) for ascending, Levine & Stray-Gundersen (1997) for descending
 * 
 * @param {number} neutralPaceSec - Pace at base altitude (seconds/km)
 * @param {number} baseAlt - Altitude acclimated to (meters)
 * @param {number} targetAlt - Target altitude (meters)
 * @returns {number} Adjusted pace (seconds/km)
 */
export function calculatePaceAtAltitude(neutralPaceSec, baseAlt, targetAlt) {
    if (!neutralPaceSec || neutralPaceSec <= 0) return 0;

    const baseVO2 = getVO2maxPercentage(baseAlt);
    const targetVO2 = getVO2maxPercentage(targetAlt);

    if (targetAlt > baseAlt) {
        // Ascending: use validated Wehrlin & Hallén model
        return neutralPaceSec * (baseVO2 / targetVO2);
    }

    if (targetAlt < baseAlt) {
        // Descending: apply modest LHTL-based improvement (1-3%)
        // Based on Levine & Stray-Gundersen (1997) "Living High-Training Low"
        const altitudeDiff = baseAlt - targetAlt;
        const improvementPercent = Math.min(3, altitudeDiff / 1000); // ~1% per 1000m, max 3%
        return neutralPaceSec * (1 - improvementPercent / 100);
    }

    return neutralPaceSec;
}

/**
 * Calculate performance gain when descending from higher altitude
 * Uses Levine & Stray-Gundersen (1997) LHTL model: ~1% per 1000m, max 3%
 * 
 * @param {number} paceAtHighAlt - Current pace at higher altitude (seconds/km)
 * @param {number} highAlt - Current/acclimated altitude (meters)
 * @param {number} lowAlt - Target lower altitude (meters)
 * @returns {object} Performance improvement details
 */
export function calculateDescentBoost(paceAtHighAlt, highAlt, lowAlt) {
    const altitudeDiff = highAlt - lowAlt;
    const gainPercent = Math.min(3, altitudeDiff / 1000); // ~1% per 1000m, max 3%
    const improvedPace = paceAtHighAlt * (1 - gainPercent / 100);
    const gainSeconds = paceAtHighAlt - improvedPace;

    return {
        originalPace: paceAtHighAlt,
        improvedPace: parseFloat(improvedPace.toFixed(2)),
        gainSeconds: parseFloat(gainSeconds.toFixed(2)),
        gainPercent: parseFloat(gainPercent.toFixed(2)),
        altitudeDiff: altitudeDiff
    };
}

// Export as a namespace-like object for consistency with WindCalc
export const AltitudeCalc = {
    getVO2maxPercentage,
    getAltitudeImpact,
    calculatePaceAtAltitude,
    calculateDescentBoost
};
