const INITIAL_STATE = {
    app: {
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
        refreshWeather: null
    },
    ui: {
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
        selectedBestRunRange: '24h',
        // Infinite Scroll State
        forecastRenderLimit: 50,
        climateRenderLimit: 50,
        SCROLL_BATCH_SIZE: 50,
        isScrollListenersSetup: false,
        isBatchLoading: false,
        activeWeatherTab: 'calculator'
    },
    requests: {}
};

const state = INITIAL_STATE;
const listeners = new Set();

function ensureRequestSlot(key) {
    if (!state.requests[key]) {
        state.requests[key] = {
            seq: 0,
            inFlight: false,
            status: 'idle',
            controller: null,
            error: null,
            startedAt: null,
            endedAt: null,
            meta: null
        };
    }
    return state.requests[key];
}

function notify(action) {
    listeners.forEach((listener) => {
        try {
            listener(state, action);
        } catch (e) {
            console.error('Store listener failed', e);
        }
    });
}

export const StoreActionTypes = {
    APP_SET_HAP_CALC: 'APP_SET_HAP_CALC',
    APP_SET_LOC_MANAGER: 'APP_SET_LOC_MANAGER',
    APP_SET_CLIMATE_MANAGER: 'APP_SET_CLIMATE_MANAGER',
    APP_SET_ELS: 'APP_SET_ELS',
    APP_SET_REFRESH_WEATHER: 'APP_SET_REFRESH_WEATHER',
    APP_SET_WEATHER_DATA: 'APP_SET_WEATHER_DATA',
    APP_SET_AIR_DATA: 'APP_SET_AIR_DATA',
    APP_PATCH_PACE_VIEW: 'APP_PATCH_PACE_VIEW',
    APP_PATCH_ALTITUDE: 'APP_PATCH_ALTITUDE',
    APP_PATCH: 'APP_PATCH',
    UI_SET_FORECAST_DATA: 'UI_SET_FORECAST_DATA',
    UI_SET_CLIMATE_DATA: 'UI_SET_CLIMATE_DATA',
    UI_PATCH: 'UI_PATCH',
    REQUEST_STARTED: 'REQUEST_STARTED',
    REQUEST_ENDED: 'REQUEST_ENDED'
};

export const RequestKeys = {
    WEATHER: 'weather',
    CLIMATE: 'climate',
    LOCATION_SEARCH: 'location_search',
    REVERSE_GEOCODE: 'reverse_geocode',
    IP_LOCATION: 'ip_location'
};

export const StoreActions = {
    setHapCalc: (hapCalc) => ({ type: StoreActionTypes.APP_SET_HAP_CALC, payload: hapCalc }),
    setLocManager: (locManager) => ({ type: StoreActionTypes.APP_SET_LOC_MANAGER, payload: locManager }),
    setClimateManager: (climateManager) => ({ type: StoreActionTypes.APP_SET_CLIMATE_MANAGER, payload: climateManager }),
    setEls: (els) => ({ type: StoreActionTypes.APP_SET_ELS, payload: els }),
    setRefreshWeather: (refreshWeather) => ({ type: StoreActionTypes.APP_SET_REFRESH_WEATHER, payload: refreshWeather }),
    setWeatherData: (weatherData) => ({ type: StoreActionTypes.APP_SET_WEATHER_DATA, payload: weatherData }),
    setAirData: (airData) => ({ type: StoreActionTypes.APP_SET_AIR_DATA, payload: airData }),
    patchPaceView: (patch) => ({ type: StoreActionTypes.APP_PATCH_PACE_VIEW, payload: patch }),
    patchAltitude: (patch) => ({ type: StoreActionTypes.APP_PATCH_ALTITUDE, payload: patch }),
    patchApp: (patch) => ({ type: StoreActionTypes.APP_PATCH, payload: patch }),
    setForecastData: (forecastData) => ({ type: StoreActionTypes.UI_SET_FORECAST_DATA, payload: forecastData }),
    setClimateData: (climateData) => ({ type: StoreActionTypes.UI_SET_CLIMATE_DATA, payload: climateData }),
    patchUI: (patch) => ({ type: StoreActionTypes.UI_PATCH, payload: patch }),
    requestStarted: (key, seq, controller, meta) => ({
        type: StoreActionTypes.REQUEST_STARTED,
        payload: { key, seq, controller, meta }
    }),
    requestEnded: (key, seq, status, error) => ({
        type: StoreActionTypes.REQUEST_ENDED,
        payload: { key, seq, status, error }
    })
};

export const AppStore = {
    getState() {
        return state;
    },
    dispatch(action) {
        if (!action || !action.type) return action;

        switch (action.type) {
            case StoreActionTypes.APP_SET_HAP_CALC:
                state.app.hapCalc = action.payload;
                break;
            case StoreActionTypes.APP_SET_LOC_MANAGER:
                state.app.locManager = action.payload;
                break;
            case StoreActionTypes.APP_SET_CLIMATE_MANAGER:
                state.app.climateManager = action.payload;
                break;
            case StoreActionTypes.APP_SET_ELS:
                state.app.els = action.payload;
                break;
            case StoreActionTypes.APP_SET_REFRESH_WEATHER:
                state.app.refreshWeather = action.payload;
                break;
            case StoreActionTypes.APP_SET_WEATHER_DATA:
                state.app.weatherData = action.payload;
                break;
            case StoreActionTypes.APP_SET_AIR_DATA:
                state.app.airData = action.payload;
                break;
            case StoreActionTypes.APP_PATCH_PACE_VIEW:
                Object.assign(state.app.paceView, action.payload || {});
                break;
            case StoreActionTypes.APP_PATCH_ALTITUDE:
                Object.assign(state.app.altitude, action.payload || {});
                break;
            case StoreActionTypes.APP_PATCH:
                Object.assign(state.app, action.payload || {});
                break;
            case StoreActionTypes.UI_SET_FORECAST_DATA:
                state.ui.forecastData = Array.isArray(action.payload) ? action.payload : [];
                break;
            case StoreActionTypes.UI_SET_CLIMATE_DATA:
                state.ui.climateData = Array.isArray(action.payload) ? action.payload : [];
                break;
            case StoreActionTypes.UI_PATCH:
                Object.assign(state.ui, action.payload || {});
                break;
            case StoreActionTypes.REQUEST_STARTED: {
                const { key, seq, controller, meta } = action.payload || {};
                const req = ensureRequestSlot(key);
                req.seq = seq;
                req.inFlight = true;
                req.status = 'running';
                req.controller = controller || null;
                req.error = null;
                req.meta = meta || null;
                req.startedAt = Date.now();
                req.endedAt = null;
                break;
            }
            case StoreActionTypes.REQUEST_ENDED: {
                const { key, seq, status, error } = action.payload || {};
                const req = ensureRequestSlot(key);
                if (typeof seq === 'number' && req.seq !== seq) break;
                req.inFlight = false;
                req.status = status || 'success';
                req.controller = null;
                req.error = error || null;
                req.endedAt = Date.now();
                break;
            }
            default:
                break;
        }

        notify(action);
        return action;
    },
    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
};

export function isRequestCurrent(key, seq) {
    const req = ensureRequestSlot(key);
    return req.seq === seq;
}

export function beginRequest(key, opts = {}) {
    const { abortPrevious = true, meta = null } = opts;
    const req = ensureRequestSlot(key);

    if (abortPrevious && req.controller) {
        try {
            req.controller.abort();
        } catch (e) {
            console.warn('Failed aborting previous request', key, e);
        }
    }

    const controller = new AbortController();
    const seq = req.seq + 1;
    AppStore.dispatch(StoreActions.requestStarted(key, seq, controller, meta));

    return { seq, controller, signal: controller.signal };
}

export function endRequest(key, seq, status = 'success', error = null) {
    AppStore.dispatch(StoreActions.requestEnded(key, seq, status, error));
}

export function cancelRequest(key, reason = 'cancelled') {
    const req = ensureRequestSlot(key);
    if (req.controller) {
        try {
            req.controller.abort();
        } catch (e) {
            console.warn('Failed cancelling request', key, e);
        }
    }
    AppStore.dispatch(StoreActions.requestEnded(key, req.seq, 'aborted', reason));
}
