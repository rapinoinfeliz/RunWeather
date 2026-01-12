// Core Application Logic: Math, Parsers, and Constants

// --- Constants ---
export const VDOT_DATA = [
    { t: 15.00, v: 67 }, { t: 16.00, v: 63 }, { t: 17.00, v: 59 },
    { t: 18.00, v: 56 }, { t: 19.00, v: 53 }, { t: 20.00, v: 49.8 },
    { t: 21.00, v: 47 }, { t: 22.00, v: 45 }, { t: 23.00, v: 43 },
    { t: 24.00, v: 41 }, { t: 25.00, v: 39 }, { t: 26.00, v: 37 },
    { t: 27.00, v: 35.5 }, { t: 28.00, v: 34 }, { t: 29.00, v: 32.5 },
    { t: 30.00, v: 31 }, { t: 32.00, v: 29 }, { t: 35.00, v: 26 },
    { t: 40.00, v: 22 }
];

export const EASY_DATA = [
    { t: 1800, p: 514 }, { t: 1780, p: 509 }, { t: 1760, p: 503 },
    { t: 1740, p: 497 }, { t: 1720, p: 491 }, { t: 1700, p: 485 },
    { t: 1680, p: 480 }, { t: 1660, p: 474 }, { t: 1640, p: 469 },
    { t: 1620, p: 463 }, { t: 1600, p: 457 }, { t: 1580, p: 451 },
    { t: 1560, p: 446 }, { t: 1540, p: 440 }, { t: 1520, p: 434 },
    { t: 1500, p: 429 }, { t: 1480, p: 423 }, { t: 1460, p: 418 },
    { t: 1440, p: 412 }, { t: 1420, p: 406 }, { t: 1400, p: 401 },
    { t: 1380, p: 395 }, { t: 1360, p: 389 }, { t: 1340, p: 383 },
    { t: 1320, p: 378 }, { t: 1300, p: 372 }, { t: 1280, p: 366 },
    { t: 1260, p: 361 }, { t: 1240, p: 355 }, { t: 1220, p: 350 },
    { t: 1200, p: 343 }, { t: 1180, p: 337 }, { t: 1160, p: 331 },
    { t: 1140, p: 326 }, { t: 1120, p: 320 }, { t: 1100, p: 314 },
    { t: 1080, p: 308 }, { t: 1060, p: 302 }, { t: 1040, p: 298 },
    { t: 1020, p: 292 }, { t: 1000, p: 286 }, { t: 980, p: 280 },
    { t: 960, p: 274 }, { t: 940, p: 268 }, { t: 920, p: 262 }
].sort((a, b) => a.t - b.t);

// --- Formatting & Parsing ---
export function parseTime(str) {
    if (!str) return 0;
    str = str.trim();

    // If no colon, treat as raw digits (e.g., "1920" → 19:20)
    if (!str.includes(':')) {
        const digits = str.replace(/[^0-9]/g, '');
        if (digits.length === 0) return 0;
        if (digits.length <= 2) {
            // Just seconds (e.g., "30" → 0:30)
            return parseInt(digits, 10);
        }
        // 3+ digits: last 2 are seconds, rest are minutes
        const secs = parseInt(digits.slice(-2), 10);
        const mins = parseInt(digits.slice(0, -2), 10);
        return mins * 60 + secs;
    }

    const parts = str.split(':').map(Number);
    // Handle MM:SS or empty
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[0] * 60 + parts[1];
    }
    // Handle HH:MM:SS
    if (parts.length === 3 && !isNaN(parts[0])) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

export function formatTime(sec) {
    if (!sec || isNaN(sec) || sec === Infinity) return "--:--";
    let m = Math.floor(sec / 60);
    let s = Math.round(sec % 60);
    if (s === 60) { m++; s = 0; }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// --- VDOT Logic ---
export const VDOT_MATH = {
    getPercentMax: (tMin) => {
        return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
    },
    getOxygenCost: (v) => { // v in m/min
        return -4.60 + 0.182258 * v + 0.000104 * (v * v);
    },
    calculateVDOT: (distMeters, timeSec) => {
        if (timeSec <= 0) return 0;
        const v = distMeters / (timeSec / 60); // m/min
        const cost = VDOT_MATH.getOxygenCost(v);
        const pct = VDOT_MATH.getPercentMax(timeSec / 60);
        return cost / pct;
    },
    solveTime: (vdot, distMeters) => {
        // Binary Search for Time
        let low = 1.0; // 1 second
        let high = 100 * 3600.0; // 100 hours
        let bestT = low;

        for (let i = 0; i < 30; i++) {
            const mid = (low + high) / 2;
            const v = distMeters / (mid / 60);
            const cost = VDOT_MATH.getOxygenCost(v);
            const pct = VDOT_MATH.getPercentMax(mid / 60);
            const calcVDOT = cost / pct;

            if (calcVDOT > vdot) {
                low = mid;
            } else {
                high = mid;
            }
            bestT = mid;
        }
        return bestT;
    },
    calculateThresholdPace: (vdot) => {
        if (!vdot || vdot <= 0) return 0;
        const fraction = 0.88;
        const targetCost = vdot * fraction;
        const a = 0.000104;
        const b = 0.182258;
        const c = -4.60 - targetCost;
        const det = b * b - 4 * a * c;
        if (det < 0) return 0;
        const v_m_min = (-b + Math.sqrt(det)) / (2 * a);
        return 60000 / v_m_min;
    }
};

export function getVDOT(fiveKSeconds) {
    const v = VDOT_MATH.calculateVDOT(5000, fiveKSeconds);
    return v.toFixed(1);
}

export function getEasyPace(fiveKSeconds) {
    if (fiveKSeconds < 920) return 262;
    if (fiveKSeconds > 1800) return 514;

    for (let i = 0; i < EASY_DATA.length - 1; i++) {
        const cur = EASY_DATA[i];
        const next = EASY_DATA[i + 1];
        if (fiveKSeconds >= cur.t && fiveKSeconds <= next.t) {
            const ratio = (fiveKSeconds - cur.t) / (next.t - cur.t);
            return cur.p + ratio * (next.p - cur.p);
        }
    }
    return 0;
}

// --- HAP Logic ---
export class HAPCalculator {
    constructor(grid) {
        // grid is a flat array of numbers: [val(H0,T0), val(H0,T1)... val(H0,T45), val(H1,T0)...]
        // T Range: 0 to 45 (46 values)
        // H Range: 0 to 100 (101 values)
        this.grid = grid;
        this.minT = 0;
        this.maxT = 45;
        this.stepH = 101;
        this.cols = 46; // T values per H row
    }

    _getAdjustmentFromGrid(t, h) {
        // Clamp indices
        const tIdx = Math.max(0, Math.min(this.maxT, Math.round(t)));
        const hIdx = Math.max(0, Math.min(100, Math.round(h)));

        // Calculate Index: (HumidityIndex * TempWidth) + TempIndex
        const index = (hIdx * this.cols) + tIdx;

        return this.grid[index] || 0;
    }

    calculateHumidity(tempC, dewC) {
        // Same physics logic
        if (dewC > tempC) dewC = tempC;
        const a = 17.625;
        const b = 243.04;
        const es = 6.112 * Math.exp((a * tempC) / (b + tempC));
        const e = 6.112 * Math.exp((a * dewC) / (b + dewC));
        let rh = (e / es) * 100;
        return Math.max(0, Math.min(100, rh));
    }

    getAdjustment(temp, dew) {
        const rh = this.calculateHumidity(temp, dew);
        return this._getAdjustmentFromGrid(temp, rh);
    }

    calculatePaceInHeat(neutralPaceSec, temp, dew) {
        if (!neutralPaceSec || neutralPaceSec <= 0) return 0;

        const rh = this.calculateHumidity(temp, dew);
        const adj = this._getAdjustmentFromGrid(temp, rh);

        const neutralSpeed = 1000.0 / neutralPaceSec;
        const actualLogSpeed = Math.log(neutralSpeed) + adj;
        const actualSpeed = Math.exp(actualLogSpeed);

        return 1000.0 / actualSpeed;
    }
}
