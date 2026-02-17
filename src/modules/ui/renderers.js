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

const FORECAST_MEMO = {
    bestRun: '',
    heatmap: '',
    table: '',
    tempChart: '',
    rainChart: '',
    windChart: ''
};

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

function renderIfChanged(key, signature, force, renderFn) {
    if (!force && FORECAST_MEMO[key] === signature) return;
    renderFn();
    FORECAST_MEMO[key] = signature;
}

export function invalidateForecastRenderMemo(keys = null) {
    const targetKeys = Array.isArray(keys) ? keys : Object.keys(FORECAST_MEMO);
    targetKeys.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(FORECAST_MEMO, k)) {
            FORECAST_MEMO[k] = '';
        }
    });
}

export function renderAllForecasts(changes = null) {
    // Backward compatibility: no args means full render.
    const full = !changes || (typeof changes === 'object' && Object.keys(changes).length === 0);
    const flags = {
        data: full || !!changes.data,
        selection: full || !!changes.selection,
        filter: full || !!changes.filter,
        sort: full || !!changes.sort,
        paceMode: full || !!changes.paceMode,
        range: full || !!changes.range,
        layout: full || !!changes.layout,
        force: full || !!changes.force
    };

    const dataSig = getDataSignature(UIState.forecastData);
    const dailySig = getDailySignature(UIState.dailyForecast);
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

    const needsBestRun = flags.force || flags.data || flags.range;
    const needsHeatmap = flags.force || flags.data || flags.selection || flags.filter || flags.paceMode || flags.layout;
    const needsTable = flags.force || flags.data || flags.selection || flags.filter || flags.sort || flags.paceMode;
    const needsCharts = flags.force || flags.data || flags.selection || flags.layout;

    if (needsBestRun) {
        const sig = `${dataSig}#${UIState.selectedBestRunRange || '24h'}`;
        renderIfChanged('bestRun', sig, flags.force, () => {
            calculateBestRunTime(UIState.forecastData);
        });
    }

    if (needsHeatmap) {
        const sig = `${baseSig}#heatmap`;
        renderIfChanged('heatmap', sig, flags.force, () => {
            renderForecastHeatmap('forecast-grid-container-16', '#legend-container-16', 14);
        });
    }

    if (needsTable) {
        const sig = `${baseSig}#table`;
        renderIfChanged('table', sig, flags.force, () => {
            renderForecastTable('forecast-body-16', 14);
        });
    }

    if (needsCharts) {
        const chartSig = `${dataSig}#${UIState.selectedForeHour || ''}#${getWidth('forecast-chart-container-16')}#temp`;
        renderIfChanged('tempChart', chartSig, flags.force, () => {
            renderForecastChart('forecast-chart-container-16', 14);
        });

        const rainSig = `${dataSig}#${UIState.selectedForeHour || ''}#${getWidth('forecast-rain-chart-container-16')}#rain`;
        renderIfChanged('rainChart', rainSig, flags.force, () => {
            renderRainChart('forecast-rain-chart-container-16', 14);
        });

        const windSig = `${dataSig}#${UIState.selectedForeHour || ''}#${getWidth('forecast-wind-chart-container-16')}#wind`;
        renderIfChanged('windChart', windSig, flags.force, () => {
            renderWindChart('forecast-wind-chart-container-16', 14);
        });
    }
}
