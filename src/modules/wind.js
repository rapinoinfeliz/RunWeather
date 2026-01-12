export const WindCalc = (function () {

    // --- Constants (Suburban Profile) ---
    const CONSTANTS = {
        ALPHA_SUBURBS: 0.30,
        DRAG_COEF: 0.8,
        AIR_DENSITY: 1.225, // kg/m^3
        AP_RATIO: 0.266,    // % of BSA facing forward
        G: 9.80665,
        HEIGHT_REF: 10,     // m
        HEIGHT_RUNNER: 1.5, // m
        GRID_MAX_MS: 12,
        GRID_STEP: 0.05
    };

    /**
     * Get Body Surface Area (m^2)
     * Ref: Livingston and Lee 2001
     */
    function getBSA(weightKg) {
        return 0.1173 * Math.pow(weightKg, 0.6466);
    }

    /**
     * Get Projected Frontal Area (m^2)
     */
    function getAp(bsa) {
        return CONSTANTS.AP_RATIO * bsa;
    }

    /**
     * Calculate Wind Speed at Runner's Height using Power Law
     * v_z = v_ref * (z / z_ref)^alpha
     */
    function getWindAtChestHeight(wind10m_ms) {
        return wind10m_ms * Math.pow(CONSTANTS.HEIGHT_RUNNER / CONSTANTS.HEIGHT_REF, CONSTANTS.ALPHA_SUBURBS);
    }

    /**
     * Metabolic Cost of Treadmill Running (Calm Air)
     * Ref: Black et al.
     * Returns W/kg
     */
    function getTreadmillCost(speed_ms, isElite = 1) {
        return 8.09986 + 0.12910 * speed_ms + 0.48105 * Math.pow(speed_ms, 2) - 1.13918 * isElite;
    }

    /**
     * Calculate Drag Force
     * Fd = 0.5 * rho * v^2 * Cd * Ap
     */
    function getDragForce(relativeV, Ap) {
        const sign = Math.sign(relativeV);
        return sign * 0.5 * CONSTANTS.AIR_DENSITY * Math.pow(relativeV, 2) * CONSTANTS.DRAG_COEF * Ap;
    }

    /**
     * Calculate Air Resistance Percentage Cost
     * Returns float fraction (e.g. 0.03 for 3%)
     */
    function getAirResistancePct(speed_ms, wind_ms, weightKg, Ap) {
        // Relative velocity: Runner Speed + Headwind Speed (Headwind is positive)
        const v_rel = speed_ms + wind_ms;
        const dragForce = getDragForce(v_rel, Ap);

        // Da Silva Slope constant = 6.13
        // Percent increase = (Drag / Weight) * 6.13
        const bodyWeightN = weightKg * CONSTANTS.G;
        const airPct = (dragForce / bodyWeightN) * 6.13;

        return airPct; // As a fraction? Original code implies dragForce/Weight * 6.13 is percentage?
        // Checking original: air_pct = dragForceFwd/bodyWeightNewtons*DA_SILVA_SLOPE
        // This likely returns a fraction if 6.13 scales it appropriately.
        // Wait, original scripts.js says "air_pct is a FLOAT percentage, i.e. 0.03 for 3%".
        // Let's assume it returns the multiplier delta.
    }

    /**
     * Calculate Total Metabolic Cost (W/kg)
     */
    function getTotalMetCost(speed_ms, wind_ms, weightKg) {
        const bsa = getBSA(weightKg);
        const Ap = getAp(bsa);

        const treadCost = getTreadmillCost(speed_ms);
        const airPct = getAirResistancePct(speed_ms, wind_ms, weightKg, Ap);

        // Cost = Base * (1 + AirPct)
        return treadCost * (1 + airPct);
    }

    /**
     * Create lookup grid for solving
     */
    function makeGrid(start, end, step) {
        const len = Math.floor((end - start) / step) + 1;
        return Array.from({ length: len }, (_, i) => start + i * step);
    }

    /**
     * Solve for Equivalent Pace
     * Finds the speed in calm air that matches the metabolic cost of running
     * at `baseSpeed_ms` with `wind_ms`.
     */
    function calculateWindAdjustedPace(baseSpeed_ms, windSpeed_kmh, weightKg = 65) {
        if (!baseSpeed_ms || baseSpeed_ms <= 0) return baseSpeed_ms;

        const wind_ms = windSpeed_kmh / 3.6;
        const trueWind_ms = getWindAtChestHeight(wind_ms);

        // Planner Logic:
        // We have a Target Effort (baseSpeed_ms in Calm Air).
        // We want to find the Speed X such that Cost(X, Wind) = Cost(baseSpeed, 0).

        // 1. Calculate Target Cost (Effort)
        const targetCost = getTotalMetCost(baseSpeed_ms, 0, weightKg);

        // 2. Build grid of costs running IN WIND
        const vGrid = makeGrid(0, CONSTANTS.GRID_MAX_MS, CONSTANTS.GRID_STEP);
        const costGrid = vGrid.map(v => getTotalMetCost(v, trueWind_ms, weightKg));

        // 3. Lookup equivalent speed
        const adjSpeed = lookupSpeed(targetCost, vGrid, costGrid); // Note: looking up Cost in CostGrid to find Speed

        return adjSpeed;
    }

    // Lookup: Given Y (Cost), find X (Speed) where Y varies with X
    // costGrid and vGrid are parallel. costGrid is roughly monotonic increasing.
    // lookupSpeed(costQuery, xGrid, yGrid) -> No, arguments were (targetCost, speedGrid, costGrid)
    // in previous implementation: lookupSpeed(costActual, vGrid, costGrid) => mapped Cost -> Speed. Correct.
    // Here: same signature. lookupSpeed(targetCost, vGrid, costGrid). Correct.

    function lookupSpeed(targetCost, speedGrid, costGrid) {
        if (targetCost < costGrid[0] || targetCost > costGrid[costGrid.length - 1]) {
            return NaN;
        }

        let i = 0;
        for (; i < costGrid.length - 1; i++) {
            if (targetCost >= costGrid[i] && targetCost <= costGrid[i + 1]) break;
        }

        // Linear Interpolation
        const y0 = costGrid[i];
        const y1 = costGrid[i + 1];
        const x0 = speedGrid[i];
        const x1 = speedGrid[i + 1];

        const pct = (targetCost - y0) / (y1 - y0);
        return x0 + (x1 - x0) * pct;
    }

    return {
        calculateWindAdjustedPace,
        // Expose for debugging/impact UI
        getImpactPercentage: (baseSpeed_ms, windSpeed_kmh, weightKg = 65) => {
            const wind_ms = windSpeed_kmh / 3.6;
            const trueWind_ms = getWindAtChestHeight(wind_ms);
            // Cost in wind
            const costWind = getTotalMetCost(baseSpeed_ms, trueWind_ms, weightKg);
            // Cost in calm air (running at same speed) - strictly for identifying "Cost of Wind" at this speed
            // Wait, usually impact is "Change in Speed".
            // The user asked for "Wind Impact: Headwind ~2.3% slowdown".
            // This implies (BaseSpeed - AdjSpeed) / BaseSpeed
            const adjSpeed = calculateWindAdjustedPace(baseSpeed_ms, windSpeed_kmh, weightKg);
            return ((baseSpeed_ms - adjSpeed) / baseSpeed_ms) * 100;
        }
    };

})();
