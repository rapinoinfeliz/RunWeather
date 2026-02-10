// renderers.js — Orchestrator & Re-exports
// Split into: charts.js, heatmaps.js, tables.js, current.js, climate.js

import { UIState } from './state.js';

// Re-export everything from sub-modules
export { renderForecastChart, renderRainChart, renderWindChart } from './charts.js';
export { renderForecastHeatmap, renderClimateHeatmap, renderClimateLegend } from './heatmaps.js';
export { renderVDOTDetails, renderForecastTable, renderClimateTable } from './tables.js';
export { renderCurrentTab } from './current.js';
export { renderOverview, calculateBestRunTime, renderMonthlyAverages } from './climate.js';

// --- Imports for orchestrator ---
import { renderForecastHeatmap } from './heatmaps.js';
import { renderForecastTable } from './tables.js';
import { renderForecastChart, renderRainChart, renderWindChart } from './charts.js';
import { calculateBestRunTime } from './climate.js';

export function renderAllForecasts() {
    calculateBestRunTime(UIState.forecastData);

    // Render 16-Day Tab (Now 14 Days)
    renderForecastHeatmap('forecast-grid-container-16', '#legend-container-16', 14);
    renderForecastTable('forecast-body-16', 14);
    renderForecastChart('forecast-chart-container-16', 14);
    renderRainChart('forecast-rain-chart-container-16', 14);
    renderWindChart('forecast-wind-chart-container-16', 14);
}
