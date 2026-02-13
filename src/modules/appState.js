// Centralized Application State — replaces all window.* globals
export const AppState = {
    // Core instances
    hapCalc: null,
    locManager: null,
    climateManager: null,

    // DOM element refs
    els: null,

    // Impact card toggle state
    paceView: { heat: false, headwind: false, tailwind: false, altitude: false },

    // Runner profile
    runner: {
        weight: 65,
        height: null,
        age: null,
        gender: null
    },

    // Altitude
    altitude: {
        base: 0,
        current: 0
    },

    // Settings
    unitSystem: 'metric',

    // Weather data (raw API responses)
    weatherData: null,
    airData: null,

    // Function refs (set at init time)
    refreshWeather: null,
};
