import { VDOT_MATH, getEasyPace } from './core.js';
import { WindCalc } from './wind.js';
import { AltitudeCalc } from './altitude.js';
import { AGE_GRADE_TABLES } from '../../data/age_grade_tables.js';

// Riegel exponent for distance projection
const RIEGEL_EXP = 1.06;

export function calculateAgeGrade(distanceMeters, timeSec, age, gender) {
    if (!distanceMeters || !timeSec || !age || !gender || !AGE_GRADE_TABLES) return null;

    // 1. Find closest standard table
    let closestDist = null;
    let minDiff = Infinity;
    let table = null;

    Object.keys(AGE_GRADE_TABLES).forEach(key => {
        const d = AGE_GRADE_TABLES[key].distance;
        const diff = Math.abs(distanceMeters - d);
        if (diff < minDiff) {
            minDiff = diff;
            closestDist = d;
            table = AGE_GRADE_TABLES[key];
        }
    });

    if (!table
        || !table.factors[gender] || !table.factors[gender][age]) return null;

    // 2. Get Factor and Open Standard
    const factor = table.factors[gender][age];
    const openStdSource = table.open[gender];

    // 3. Project Open Standard to Input Distance (Riegel)
    // T2 = T1 * (D2/D1)^1.06
    const projectedOpenStd = openStdSource * Math.pow((distanceMeters / closestDist), RIEGEL_EXP);

    // 4. Calculate Age Graded Time (User's time adjusted to Open equivalent)
    // Actually, "Age Graded Time" usually means "What your time would be if you were Open age"
    // GradedTime = InputTime * Factor
    const ageGradedTime = timeSec * factor;

    // 5. Calculate Score
    // Score = OpenStandard / AgeGradedTime
    // Logic: If I run 20:00 (1200) and factor is 1.0 (Open), Score = Std/1200.
    // If I run 20:00 and factor is 0.9. Graded = 18:00 (1080). Score = Std/1080.
    // Wait, let's verify if OpenStd needs projection.
    // Yes. If I run 6k, I compare to 6k WR.
    const score = (projectedOpenStd / ageGradedTime) * 100;

    let clss = '';
    if (score >= 100) clss = 'World Record Level';
    else if (score >= 90) clss = 'World Class';
    else if (score >= 80) clss = 'National Class';
    else if (score >= 70) clss = 'Regional Class';
    else if (score >= 60) clss = 'Local Class';
    else clss = '';

    return {
        score: parseFloat(score.toFixed(2)),
        ageGradedTime: Math.round(ageGradedTime),
        class: clss,
        closestDist: closestDist,
        factor: factor
    };
}

export function calculatePacingState(inputs, hapCalc) {
    const { distance, timeSec, temp, dew } = inputs;

    // Default Result Structure
    const result = {
        valid: false,
        vdot: 0,
        pred5kSec: 0,
        pred5kPace: 0,
        inputPaceSec: 0,
        paces: {
            threshold: 0,
            p10min: 0,
            p6min: 0,
            p3min: 0,
            p1min: 0,
            easy: 0
        },
        weather: {
            valid: false,
            impactPct: 0,
            adjustedPaces: {}, // key: paceSec
            temp: temp,
            dew: dew
        },
        altitude: {
            valid: false,
            impactPct: 0,
            deltaAlt: 0,
            targetAlt: 0,
            baseAlt: 0,
            adjustedPaces: {}
        }
    };

    if (!distance || !timeSec || distance <= 0) {
        return result;
    }

    result.valid = true;
    result.inputPaceSec = timeSec / (distance / 1000);

    const vdotScore = VDOT_MATH.calculateVDOT(distance, timeSec);
    result.vdot = vdotScore;

    const pred5kSec = VDOT_MATH.solveTime(vdotScore, 5000);
    const pred5kPace = pred5kSec / 5;
    result.pred5kSec = pred5kSec;
    result.pred5kPace = pred5kPace;

    // Calculate Paces
    result.paces.threshold = VDOT_MATH.calculateThresholdPace(vdotScore);
    result.paces.p10min = 1.0552 * pred5kPace + 15.19;
    result.paces.p6min = 1.0256 * pred5kPace + 14.12;
    result.paces.p3min = 1.0020 * pred5kPace + 13.20;

    // 10KP (1 min reps) - Calculate exact 10k Pace
    const t10k = VDOT_MATH.solveTime(vdotScore, 10000);
    result.paces.p1min = t10k / 10;

    result.paces.easy = getEasyPace(pred5kSec);

    // Weather Logic
    const useWeather = hapCalc && !isNaN(temp);
    const d = !isNaN(dew) ? dew : temp;
    const windKmh = inputs.wind || 0;
    const runnerWeight = inputs.runnerWeight || 65;

    // Heat Calculations
    if (useWeather) {
        result.weather.valid = true;
        result.weather.dew = d;

        // Impact on Ref Pace (Heat)
        const ref = 300;
        const adjRef = hapCalc.calculatePaceInHeat(ref, temp, d);
        result.weather.impactPct = ((adjRef - ref) / ref) * 100;

        // Adjust all calculated paces (Heat)
        Object.keys(result.paces).forEach(key => {
            const val = result.paces[key];
            if (val > 0) {
                result.weather.adjustedPaces[key] = hapCalc.calculatePaceInHeat(val, temp, d);
            } else {
                result.weather.adjustedPaces[key] = 0;
            }
        });
    }

    // Wind Calculations (Independent of Heat validity, but usually grouped)
    if (windKmh > 0) {
        result.weather.valid = true;

        // Wind Impact Stats (Headwind on Ref Pace)
        const ref = 300; // 5:00/km
        const refSpeed = 1000 / ref; // Convert to m/s

        const headwindImpact = WindCalc.getImpactPercentage(refSpeed, windKmh, runnerWeight);
        const tailwindImpact = WindCalc.getImpactPercentage(refSpeed, -windKmh, runnerWeight);

        result.weather.windImpact = {
            headwindPct: headwindImpact,
            tailwindPct: tailwindImpact
        };
        result.weather.windPaces = {};

        Object.keys(result.paces).forEach(key => {
            const val = result.paces[key]; // Pace in s/km
            if (val > 0) {
                const speedMs = 1000 / val; // Convert to m/s

                // Calculate Adjusted Speeds (m/s)
                const hwSpeed = WindCalc.calculateWindAdjustedPace(speedMs, windKmh, runnerWeight);
                const twSpeed = WindCalc.calculateWindAdjustedPace(speedMs, -windKmh, runnerWeight);

                // Convert back to Pace (s/km)
                result.weather.windPaces[key] = {
                    headwind: hwSpeed > 0 ? 1000 / hwSpeed : 0,
                    tailwind: twSpeed > 0 ? 1000 / twSpeed : 0
                };
            }
        });
    }

    // Altitude Calculations
    const baseAlt = inputs.baseAltitude || 0;
    const targetAlt = inputs.currentElevation || 0;
    const altDelta = Math.abs(targetAlt - baseAlt);

    // Calculate if there's a meaningful altitude difference (>100m)
    if (altDelta > 100) {
        result.altitude.valid = true;
        result.altitude.baseAlt = baseAlt;
        result.altitude.targetAlt = targetAlt;
        result.altitude.deltaAlt = targetAlt - baseAlt;

        if (targetAlt > baseAlt) {
            // Ascending - pace penalty
            const altImpact = AltitudeCalc.getAltitudeImpact(baseAlt, targetAlt);
            result.altitude.impactPct = altImpact.impactPct;
            result.altitude.vo2Drop = altImpact.vo2Drop;
        } else {
            // Descending - pace boost (negative impact = faster)
            const altImpact = AltitudeCalc.getAltitudeImpact(targetAlt, baseAlt);
            result.altitude.impactPct = -altImpact.impactPct; // Negative = faster
            result.altitude.vo2Drop = -altImpact.vo2Drop;
        }

        // Apply altitude adjustment to all paces (works for both directions)
        Object.keys(result.paces).forEach(key => {
            const val = result.paces[key];
            if (val > 0) {
                result.altitude.adjustedPaces[key] = AltitudeCalc.calculatePaceAtAltitude(val, baseAlt, targetAlt);
            }
        });
    }

    return result;
}

// --- WBGT Calculation (ACSM / BOM Estimation) ---
export function calculateWBGT(temp, rh, wind, solar) {
    // 1. Estimate Wet Bulb (Tw) using Stull (2011)
    // T = Temp (C), RH = %
    const T = temp;
    const RH = rh;
    const Tw = T * Math.atan(0.151977 * Math.pow(RH + 8.313659, 0.5)) +
        Math.atan(T + RH) - Math.atan(RH - 1.676331) +
        0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) - 4.686035;

    // 2. Estimate Black Globe Temp (Tg)
    // Uses a simplified approximation for outdoor runners
    // Tg grows with Radiation and shrinks with Wind.
    // f(wind) = exp(-0.3 * wind) (Wind in m/s)
    const windMs = wind / 3.6;
    const windFactor = Math.exp(-0.25 * windMs); // Wind cooling effect on the globe
    const Tg = T + (0.019 * solar * windFactor); // Solar heating factor adjusted for wind

    // 3. Calculate Outdoor WBGT
    // WBGT = 0.7 * Tw + 0.2 * Tg + 0.1 * T
    const wbgt = (0.7 * Tw) + (0.2 * Tg) + (0.1 * T);
    return wbgt;
}
