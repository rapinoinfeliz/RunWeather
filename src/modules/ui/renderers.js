// renderers.js — Orchestrator & Re-exports
// Split into: charts.js, heatmaps.js, tables.js, current.js, climate.js

import { UIState } from './state.js';
import { AppState } from '../appState.js';

// Re-export everything from sub-modules
export { renderForecastChart, renderRainChart, renderWindChart } from './charts.js';
export { renderForecastHeatmap, renderClimateHeatmap, renderClimateLegend } from './heatmaps.js';
export { renderVDOTDetails, renderForecastTable, renderClimateTable } from './tables.js';
export { renderCurrentTab } from './current.js';
export { renderOverview, calculateBestRunTime, renderMonthlyAverages, toggleMonthlyAverages } from './climate.js';

// --- Imports for orchestrator ---
import { renderForecastHeatmap } from './heatmaps.js';
import { renderForecastTable } from './tables.js';
import { renderForecastChart, renderRainChart, renderWindChart } from './charts.js';
import { calculateBestRunTime } from './climate.js';

const FORECAST_FLAG_KEYS = ['data', 'selection', 'filter', 'sort', 'paceMode', 'range', 'layout', 'force'];

const FORECAST_MEMO = {
    bestRun: '',
    heatmap: '',
    table: '',
    tempChart: '',
    rainChart: '',
    windChart: ''
};

const FORECAST_SIG_MEMO = {
    dataRef: null,
    dataSig: '0',
    dailyRef: null,
    dailySig: '0'
};

let pendingForecastFlags = createEmptyForecastFlags();
let isForecastRenderInFlight = false;
let deferredChartFrame = 0;

function createEmptyForecastFlags() {
    return {
        data: false,
        selection: false,
        filter: false,
        sort: false,
        paceMode: false,
        range: false,
        layout: false,
        force: false
    };
}

function getDataSignature(data) {
    if (!data || data.length === 0) return '0';
    const len = data.length;
    const pick = [0, 1, 2, Math.floor(len / 2), len - 3, len - 2, len - 1]
        .filter((idx) => idx >= 0 && idx < len);
    let digest = '';
    pick.forEach((idx) => {
        const d = data[idx];
        if (!d) return;
        digest += `|${idx}:${d.time || ''}:${d.temp ?? ''}:${d.dew ?? ''}:${d.rain ?? ''}:${d.prob ?? ''}:${d.wind ?? ''}:${d.weathercode ?? ''}`;
    });
    return `${len}${digest}`;
}

function getDailySignature(daily) {
    if (!daily || !daily.time || !daily.time.length) return '0';
    const first = 0;
    const last = daily.time.length - 1;
    return [
        daily.time.length,
        daily.time[first] || '',
        daily.time[last] || '',
        daily.sunrise && daily.sunrise[first] ? daily.sunrise[first] : '',
        daily.sunrise && daily.sunrise[last] ? daily.sunrise[last] : '',
        daily.sunset && daily.sunset[first] ? daily.sunset[first] : '',
        daily.sunset && daily.sunset[last] ? daily.sunset[last] : ''
    ].join('|');
}

function getWidth(id) {
    const el = document.getElementById(id);
    return el ? el.clientWidth : 0;
}

function hasAnyForecastFlag(flags) {
    return !!(
        flags.data
        || flags.selection
        || flags.filter
        || flags.sort
        || flags.paceMode
        || flags.range
        || flags.layout
        || flags.force
    );
}

function normalizeForecastChanges(changes = null) {
    const isObject = typeof changes === 'object' && changes !== null;
    const full = !changes || (isObject && Object.keys(changes).length === 0);

    if (full) {
        return {
            data: true,
            selection: true,
            filter: true,
            sort: true,
            paceMode: true,
            range: true,
            layout: true,
            force: true
        };
    }
    if (!isObject) {
        return createEmptyForecastFlags();
    }

    const normalized = createEmptyForecastFlags();
    FORECAST_FLAG_KEYS.forEach((key) => {
        normalized[key] = !!changes[key];
    });
    return normalized;
}

function mergeForecastFlags(base, incoming) {
    const merged = createEmptyForecastFlags();
    FORECAST_FLAG_KEYS.forEach((key) => {
        merged[key] = !!(base[key] || incoming[key]);
    });
    return merged;
}

function getDataSignatureMemoized(data) {
    if (FORECAST_SIG_MEMO.dataRef === data) {
        return FORECAST_SIG_MEMO.dataSig;
    }
    const sig = getDataSignature(data);
    FORECAST_SIG_MEMO.dataRef = data;
    FORECAST_SIG_MEMO.dataSig = sig;
    return sig;
}

function getDailySignatureMemoized(daily) {
    if (FORECAST_SIG_MEMO.dailyRef === daily) {
        return FORECAST_SIG_MEMO.dailySig;
    }
    const sig = getDailySignature(daily);
    FORECAST_SIG_MEMO.dailyRef = daily;
    FORECAST_SIG_MEMO.dailySig = sig;
    return sig;
}

function renderIfChanged(key, signature, force, renderFn) {
    if (!force && FORECAST_MEMO[key] === signature) return;
    renderFn();
    FORECAST_MEMO[key] = signature;
}

function finalizeForecastCycle() {
    isForecastRenderInFlight = false;
    if (hasAnyForecastFlag(pendingForecastFlags)) {
        drainForecastRenderQueue();
    }
}

function renderDeferredCharts(flags, dataSig) {
    const selectedHour = UIState.selectedForeHour || '';
    const tasks = [
        () => {
            const sig = `${dataSig}#${selectedHour}#${getWidth('forecast-chart-container-16')}#temp`;
            renderIfChanged('tempChart', sig, flags.force, () => {
                renderForecastChart('forecast-chart-container-16', 14);
            });
        },
        () => {
            const sig = `${dataSig}#${selectedHour}#${getWidth('forecast-rain-chart-container-16')}#rain`;
            renderIfChanged('rainChart', sig, flags.force, () => {
                renderRainChart('forecast-rain-chart-container-16', 14);
            });
        },
        () => {
            const sig = `${dataSig}#${selectedHour}#${getWidth('forecast-wind-chart-container-16')}#wind`;
            renderIfChanged('windChart', sig, flags.force, () => {
                renderWindChart('forecast-wind-chart-container-16', 14);
            });
        }
    ];

    const runNext = () => {
        deferredChartFrame = 0;

        // A newer render request arrived. Stop this cycle and restart with merged flags.
        if (hasAnyForecastFlag(pendingForecastFlags)) {
            finalizeForecastCycle();
            return;
        }

        const next = tasks.shift();
        if (!next) {
            finalizeForecastCycle();
            return;
        }

        next();

        if (tasks.length === 0) {
            finalizeForecastCycle();
            return;
        }

        deferredChartFrame = requestAnimationFrame(runNext);
    };

    deferredChartFrame = requestAnimationFrame(runNext);
}

function executeForecastRenderCycle(flags) {
    const needsBestRun = flags.force || flags.data || flags.range;
    const needsHeatmap = flags.force || flags.data || flags.selection || flags.filter || flags.paceMode || flags.layout;
    const needsTable = flags.force || flags.data || flags.selection || flags.filter || flags.sort || flags.paceMode;
    const needsCharts = flags.force || flags.data || flags.selection || flags.layout;

    const needsDataSig = needsBestRun || needsHeatmap || needsTable || needsCharts;
    const dataSig = needsDataSig ? getDataSignatureMemoized(UIState.forecastData) : '0';
    const dailySig = (needsHeatmap || needsTable)
        ? getDailySignatureMemoized(UIState.dailyForecast)
        : '0';

    if (needsBestRun) {
        const sig = `${dataSig}#${UIState.selectedBestRunRange || '24h'}`;
        renderIfChanged('bestRun', sig, flags.force, () => {
            calculateBestRunTime(UIState.forecastData);
        });
    }

    if (needsHeatmap || needsTable) {
        const baseSig = [
            dataSig,
            UIState.selectedForeHour || '',
            UIState.selectedImpactFilter || '',
            UIState.currentPaceMode || 'HMP',
            UIState.selectedBestRunRange || '24h',
            UIState.forecastSortCol || 'time',
            UIState.forecastSortDir || 'asc',
            AppState.weatherData && AppState.weatherData.timezone ? AppState.weatherData.timezone : '',
            dailySig
        ].join('#');

        if (needsHeatmap) {
            renderIfChanged('heatmap', `${baseSig}#heatmap`, flags.force, () => {
                renderForecastHeatmap('forecast-grid-container-16', '#legend-container-16', 14);
            });
        }

        if (needsTable) {
            renderIfChanged('table', `${baseSig}#table`, flags.force, () => {
                renderForecastTable('forecast-body-16', 14);
            });
        }
    }

    if (!needsCharts) {
        finalizeForecastCycle();
        return;
    }

    renderDeferredCharts(flags, dataSig);
}

function drainForecastRenderQueue() {
    if (isForecastRenderInFlight) return;
    if (!hasAnyForecastFlag(pendingForecastFlags)) return;

    const flags = pendingForecastFlags;
    pendingForecastFlags = createEmptyForecastFlags();
    isForecastRenderInFlight = true;

    if (deferredChartFrame) {
        cancelAnimationFrame(deferredChartFrame);
        deferredChartFrame = 0;
    }

    executeForecastRenderCycle(flags);
}

export function invalidateForecastRenderMemo(keys = null) {
    const targetKeys = Array.isArray(keys) ? keys : Object.keys(FORECAST_MEMO);
    targetKeys.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(FORECAST_MEMO, k)) {
            FORECAST_MEMO[k] = '';
        }
    });

    if (!Array.isArray(keys)) {
        FORECAST_SIG_MEMO.dataRef = null;
        FORECAST_SIG_MEMO.dataSig = '0';
        FORECAST_SIG_MEMO.dailyRef = null;
        FORECAST_SIG_MEMO.dailySig = '0';
    }
}

export function renderAllForecasts(changes = null) {
    const normalizedFlags = normalizeForecastChanges(changes);
    pendingForecastFlags = mergeForecastFlags(pendingForecastFlags, normalizedFlags);
    drainForecastRenderQueue();
}
