import { CV_THRESHOLD_RANGE_MODEL } from '../../data/cv_threshold_range_model.js';

const DEFAULT_AGE = 25;
const MIN_VALID_SPEED_MPS = 0.5;

const OUTCOME_KEYS = [
    'cs_minus_10',
    'cs_minus_50',
    'cs_minus_90',
    'cs_10',
    'cs_50',
    'cs_90',
    'cs_plus_10',
    'cs_plus_50',
    'cs_plus_90'
];

function findIndex(value, grid) {
    if (value <= grid[0]) return 0;
    if (value >= grid[grid.length - 1]) return grid.length - 2;

    for (let i = 0; i < grid.length - 1; i += 1) {
        if (value >= grid[i] && value <= grid[i + 1]) {
            return i;
        }
    }
    return 0;
}

function bilinearInterp(distGrid, timeGrid, teMatrix, queryDist, queryTime) {
    const i = findIndex(queryDist, distGrid);
    const j = findIndex(queryTime, timeGrid);

    const d1 = distGrid[i];
    const d2 = distGrid[i + 1];
    const t1 = timeGrid[j];
    const t2 = timeGrid[j + 1];

    const td = (queryDist - d1) / (d2 - d1);
    const tt = (queryTime - t1) / (t2 - t1);

    const q11 = teMatrix[i][j];
    const q21 = teMatrix[i + 1][j];
    const q12 = teMatrix[i][j + 1];
    const q22 = teMatrix[i + 1][j + 1];

    return ((1 - td) * (1 - tt) * q11)
        + (td * (1 - tt) * q21)
        + ((1 - td) * tt * q12)
        + (td * tt * q22);
}

function lookupAgeSmooth(ageSmooth, queryAge) {
    const grid = CV_THRESHOLD_RANGE_MODEL.age_grid;
    let closestIndex = 0;
    let smallestDiff = Math.abs(grid[0] - queryAge);

    for (let i = 1; i < grid.length; i += 1) {
        const diff = Math.abs(grid[i] - queryAge);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            closestIndex = i;
        }
    }

    return ageSmooth[closestIndex];
}

function predictTeOutcome(outcomeKey, log10Dist, log10Time, ageYears) {
    const params = CV_THRESHOLD_RANGE_MODEL.models[outcomeKey];
    if (!params) return NaN;

    const teEffect = bilinearInterp(
        CV_THRESHOLD_RANGE_MODEL.log10_dist_grid,
        CV_THRESHOLD_RANGE_MODEL.log10_time_grid,
        params.te_smooth,
        log10Dist,
        log10Time
    );

    const ageEffect = lookupAgeSmooth(params.age_smooth, ageYears);
    return params.beta0 + ageEffect + teEffect;
}

function toPaceSecPerKm(speedMps) {
    if (!Number.isFinite(speedMps) || speedMps < MIN_VALID_SPEED_MPS) return null;
    const pace = 1000 / speedMps;
    return Number.isFinite(pace) ? pace : null;
}

function buildRange(secA, secB) {
    if (!Number.isFinite(secA) || !Number.isFinite(secB)) return null;
    return {
        fastSecPerKm: Math.min(secA, secB),
        slowSecPerKm: Math.max(secA, secB)
    };
}

function buildCategory(safeSpeed, medianSpeed, rangeSpeedA, rangeSpeedB) {
    const safeSecPerKm = toPaceSecPerKm(safeSpeed);
    const medianSecPerKm = toPaceSecPerKm(medianSpeed);
    const rangeA = toPaceSecPerKm(rangeSpeedA);
    const rangeB = toPaceSecPerKm(rangeSpeedB);

    if (safeSecPerKm == null || medianSecPerKm == null || rangeA == null || rangeB == null) {
        return null;
    }

    const range = buildRange(rangeA, rangeB);
    if (!range) return null;

    return {
        safeSecPerKm,
        medianSecPerKm,
        rangeFastSecPerKm: range.fastSecPerKm,
        rangeSlowSecPerKm: range.slowSecPerKm
    };
}

export function estimateCvTrainingPaces(distanceMeters, timeSeconds, ageYears = DEFAULT_AGE) {
    const distance = Number(distanceMeters);
    const time = Number(timeSeconds);

    if (!Number.isFinite(distance) || !Number.isFinite(time) || distance <= 0 || time <= 0) {
        return null;
    }

    const log10Dist = Math.log10(distance);
    const log10Time = Math.log10(time);
    if (!Number.isFinite(log10Dist) || !Number.isFinite(log10Time)) return null;

    const ageInput = Number(ageYears);
    const age = Number.isFinite(ageInput) && ageInput > 0 ? ageInput : DEFAULT_AGE;

    const predicted = {};
    OUTCOME_KEYS.forEach((key) => {
        predicted[key] = predictTeOutcome(key, log10Dist, log10Time, age);
    });

    const threshold = buildCategory(
        predicted.cs_minus_10,
        predicted.cs_minus_50,
        predicted.cs_minus_90,
        predicted.cs_minus_10
    );

    const cv = buildCategory(
        predicted.cs_50,
        predicted.cs_50,
        predicted.cs_90,
        predicted.cs_10
    );

    const vo2max = buildCategory(
        predicted.cs_plus_90,
        predicted.cs_plus_50,
        predicted.cs_plus_90,
        predicted.cs_plus_10
    );

    if (!threshold || !cv || !vo2max) return null;

    return {
        threshold,
        cv,
        vo2max,
        ageUsed: age,
        model: 'cv-threshold-calculator'
    };
}

export function estimateThresholdPaceRange(distanceMeters, timeSeconds, ageYears = DEFAULT_AGE) {
    const result = estimateCvTrainingPaces(distanceMeters, timeSeconds, ageYears);
    if (!result) return null;

    return {
        fasterSecPerKm: result.threshold.rangeFastSecPerKm,
        slowerSecPerKm: result.threshold.rangeSlowSecPerKm,
        quantileP10SecPerKm: result.threshold.safeSecPerKm,
        quantileP90SecPerKm: result.threshold.rangeFastSecPerKm,
        ageUsed: result.ageUsed,
        model: result.model
    };
}
