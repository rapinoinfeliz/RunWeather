export const UIState = {
    forecastData: [],
    selectedImpactFilter: null,
    climateSortDir: 'asc',
    climateSortCol: 'date',
    climateImpactFilter: null,
    selectedClimateKey: null,
    forecastSortCol: 'time',
    forecastSortDir: 'asc',
    selectedForeHour: null,
    isDark: false,
    currentWeatherData: null,
    climateData: [],
    currentPaceMode: 'HMP',
    selectedBestRunRange: '14 Days', // Default
    // Infinite Scroll State
    forecastRenderLimit: 50,
    climateRenderLimit: 50,
    SCROLL_BATCH_SIZE: 50,
    isScrollListenersSetup: false,
    isBatchLoading: false,
    activeWeatherTab: 'calculator' // Default to calculator
};

// Bind to window for legacy support if needed, 
// though we usually do this in the initialization code.
// Ideally, main.js should not read these directly anymore, 
// but if it does, we can proxy them in ui.js or index.js.
