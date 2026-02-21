
// UI Module - Reconstructed
import { HAPCalculator, VDOT_MATH, parseTime, formatTime, getEasyPace, getISOWeek } from './core.js';
import { calculatePacingState, calculateWBGT, calculateAgeGrade } from './engine.js';
import { fetchWeatherData, searchCity, fetchIpLocation, reverseGeocode, fetchLocationPreview } from './api.js';
import { saveToStorage, loadFromStorage } from './storage.js';
import { AppState } from './appState.js';
import { AppStore, StoreActions, RequestKeys, beginRequest, endRequest, isRequestCurrent, cancelRequest } from './store.js';
import { renderCurrentTab, renderForecastChart, renderRainChart, renderWindChart, renderClimateTable, renderClimateLegend, renderClimateHeatmap, renderForecastHeatmap, renderForecastTable, renderVDOTDetails, renderAllForecasts, renderOverview, calculateBestRunTime, renderMonthlyAverages, toggleMonthlyAverages } from './ui/renderers.js';
export { renderCurrentTab, renderForecastChart, renderRainChart, renderWindChart, renderClimateTable, renderClimateLegend, renderClimateHeatmap, renderForecastHeatmap, renderForecastTable, renderVDOTDetails, renderAllForecasts, renderOverview, calculateBestRunTime, renderMonthlyAverages, toggleMonthlyAverages };
import { UIState } from './ui/state.js';
export { UIState };
import { infoIcon, getImpactColor, getDewColor, getCondColor, getImpactCategory, getBasePaceSec, getDateFromWeek, animateValue, showToast, updateWeatherTabState } from './ui/utils.js';
export { infoIcon, getImpactColor, getDewColor, getCondColor, getImpactCategory, getBasePaceSec, getDateFromWeek, animateValue, showToast, updateWeatherTabState };
import { openTab, setPaceMode, toggleForeSort, setBestRunRange, toggleImpactFilter, copyConditions, sortForecastTable, handleCellHover, showForeTooltip, moveForeTooltip, hideForeTooltip } from './ui/events.js';
export { openTab, setPaceMode, toggleForeSort, setBestRunRange, toggleImpactFilter, copyConditions, sortForecastTable, handleCellHover, showForeTooltip, moveForeTooltip, hideForeTooltip };
import { initRipple } from './ui/effects.js';
import {
    elevationUnit,
    formatDisplayElevation,
    formatDisplayPrecip,
    formatDisplayTemperature,
    formatDisplayWind,
    formatPace,
    getUnitSystem,
    paceUnit,
    precipitationUnit,
    temperatureUnit,
    toMetricTemperature,
    toMetricWind,
    windUnit
} from './units.js';
import { estimateCvTrainingPaces } from './cvThresholdRange.js';

function appendLocationLabel(container, name, subText, subClass) {
    const label = document.createElement('div');
    label.appendChild(document.createTextNode(name || 'Unknown'));

    if (subText) {
        label.appendChild(document.createTextNode(' '));
        const sub = document.createElement('span');
        sub.className = subClass;
        sub.textContent = subText;
        label.appendChild(sub);
    }

    container.appendChild(label);
}

const COUNTRY_LABEL_BY_CODE = {
    BR: 'Brasil',
    US: 'EUA',
    GB: 'Reino Unido',
    AR: 'Argentina',
    CL: 'Chile',
    CO: 'Colômbia',
    UY: 'Uruguai',
    PY: 'Paraguai',
    PE: 'Peru',
    BO: 'Bolívia',
    MX: 'México',
    CA: 'Canadá',
    ES: 'Espanha',
    PT: 'Portugal',
    FR: 'França',
    DE: 'Alemanha',
    IT: 'Itália',
    JP: 'Japão',
    CN: 'China',
    AU: 'Austrália',
    NZ: 'Nova Zelândia'
};

function formatCountryLabel(country) {
    const value = String(country || '').trim();
    if (!value) return '';
    if (/^[A-Za-z]{2}$/.test(value)) {
        const code = value.toUpperCase();
        return COUNTRY_LABEL_BY_CODE[code] || code;
    }
    return value;
}

function getLocationSubtext(loc) {
    if (!loc) return '';
    const region = (loc.region || loc.admin1 || loc.state || '').toString().trim();
    const country = formatCountryLabel(loc.country);
    const stateText = region || '--';
    const countryText = country || '--';
    return `${stateText}, ${countryText}`;
}

let locationSearchDebounceTimer = null;
let locationSearchSeq = 0;
let lastLocationFocus = null;
let mapLibreLoaderPromise = null;
let locationPickerMap = null;
let locationPickerMarker = null;
let locationPickerMapClickHandler = null;
let locationPickerMapMoveHandler = null;
let locationPickerMapLeaveHandler = null;
let locationPickerReverseSeq = 0;
let pendingLocationSelection = null;
let activeLocationSearchItem = null;
let locationElevationSeq = 0;
let locationPreviewSeq = 0;
let locationNameFitRaf = 0;
const locationElevationCache = new Map();
let pendingLocationPreview = {
    status: 'idle',
    data: null,
    error: null
};

const MAPLIBRE_CSS_ID = 'rw-maplibre-css';
const MAPLIBRE_SCRIPT_ID = 'rw-maplibre-script';
const MAPLIBRE_CSS_URL = 'https://unpkg.com/maplibre-gl@5.3.1/dist/maplibre-gl.css';
const MAPLIBRE_SCRIPT_URL = 'https://unpkg.com/maplibre-gl@5.3.1/dist/maplibre-gl.js';
const LOCATION_MAP_BASE_LAYER_ID = 'rw-osm-base-layer';

const LOCATION_MAP_BASE_STYLE = {
    version: 8,
    sources: {
        'rw-osm': {
            type: 'raster',
            tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
        }
    },
    layers: [
        {
            id: LOCATION_MAP_BASE_LAYER_ID,
            type: 'raster',
            source: 'rw-osm',
            paint: {
                'raster-saturation': -0.15,
                'raster-contrast': 0.08,
                'raster-brightness-min': 0.09,
                'raster-brightness-max': 0.9
            }
        }
    ]
};

function isDesktopMapPickerViewport() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(min-width: 861px) and (hover: hover)').matches;
}

function setLocationMapStatus(text, tone = '') {
    const statusEl = document.getElementById('loc-map-status');
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.classList.remove('loc-map-status--ready', 'loc-map-status--error');
    if (tone === 'ready') statusEl.classList.add('loc-map-status--ready');
    if (tone === 'error') statusEl.classList.add('loc-map-status--error');
}

function setLocationMapReadout(text) {
    const readoutEl = document.getElementById('loc-map-readout');
    if (!readoutEl) return;
    readoutEl.textContent = text || 'Lat -- | Lon --';
}

function getLocationCoordKey(lat, lon) {
    const nLat = Number(lat);
    const nLon = Number(lon);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return '';
    return `${nLat.toFixed(4)}:${nLon.toFixed(4)}`;
}

function parseElevationPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (Array.isArray(payload.elevation) && payload.elevation.length > 0) {
        const first = Number(payload.elevation[0]);
        return Number.isFinite(first) ? first : null;
    }
    const raw = Number(payload.elevation);
    return Number.isFinite(raw) ? raw : null;
}

function setInlineGpsButtonLoading(isLoading, title = '') {
    const btn = document.getElementById('loc-gps-btn');
    if (!btn) return;
    btn.disabled = !!isLoading;
    btn.classList.toggle('is-loading', !!isLoading);
    btn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    btn.title = title || (isLoading ? 'Locating...' : 'Use my location');
}

function toLocationSelection(input) {
    if (!input || typeof input !== 'object') return null;
    const lat = Number(input.lat);
    const lon = Number(input.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const elevationRaw = Number(input.elevation ?? input.altitude);
    const elevation = Number.isFinite(elevationRaw) ? elevationRaw : null;
    return {
        lat,
        lon,
        name: String(input.name || 'Pinned Location').trim() || 'Pinned Location',
        country: String(input.country || '').trim(),
        region: String(input.region || input.admin1 || input.state || '').trim(),
        elevation
    };
}

function clearActiveLocationSearchItem() {
    if (activeLocationSearchItem && activeLocationSearchItem.classList) {
        activeLocationSearchItem.classList.remove('active');
    }
    activeLocationSearchItem = null;
}

function setActiveLocationSearchItem(el) {
    clearActiveLocationSearchItem();
    if (el && el.classList) {
        el.classList.add('active');
        activeLocationSearchItem = el;
    }
}

function fitLocationNameToSingleLine() {
    const nameEl = document.getElementById('loc-selected-name');
    if (!nameEl) return;
    const width = Number(nameEl.clientWidth);
    if (!Number.isFinite(width) || width <= 0) return;

    // Reset to CSS baseline before fitting so short names can grow back.
    nameEl.style.fontSize = '';
    const computed = parseFloat(window.getComputedStyle(nameEl).fontSize);
    const maxFont = Number.isFinite(computed) ? computed : 26;
    const minFont = 8;
    nameEl.style.fontSize = `${maxFont}px`;

    if (nameEl.scrollWidth <= nameEl.clientWidth + 1) return;

    let low = minFont;
    let high = maxFont;
    for (let i = 0; i < 11; i++) {
        const mid = (low + high) / 2;
        nameEl.style.fontSize = `${mid}px`;
        if (nameEl.scrollWidth <= nameEl.clientWidth + 1) {
            low = mid;
        } else {
            high = mid;
        }
    }

    let fitted = Math.max(minFont, Math.min(low, maxFont));
    nameEl.style.fontSize = `${fitted.toFixed(2)}px`;

    // Safety fallback for extreme names: scale once more so it always fits.
    if (nameEl.scrollWidth > nameEl.clientWidth + 1) {
        const ratio = nameEl.clientWidth / nameEl.scrollWidth;
        const forceFit = Math.max(6.5, fitted * ratio * 0.995);
        fitted = Math.min(fitted, forceFit);
        nameEl.style.fontSize = `${fitted.toFixed(2)}px`;
    }
}

function scheduleLocationNameFit() {
    if (typeof window === 'undefined') return;
    if (locationNameFitRaf) window.cancelAnimationFrame(locationNameFitRaf);
    locationNameFitRaf = window.requestAnimationFrame(() => {
        locationNameFitRaf = 0;
        fitLocationNameToSingleLine();
    });
}

function syncMapMarkerToSelection(selection, options = {}) {
    if (!selection || !locationPickerMap) return;
    const { recenter = true } = options;
    const lngLat = [selection.lon, selection.lat];
    if (!locationPickerMarker && window.maplibregl && typeof window.maplibregl.Marker === 'function') {
        locationPickerMarker = new window.maplibregl.Marker({ color: '#60a5fa' })
            .setLngLat(lngLat)
            .addTo(locationPickerMap);
    } else if (locationPickerMarker) {
        locationPickerMarker.setLngLat(lngLat);
    }
    if (recenter) {
        const currentZoom = Number(locationPickerMap.getZoom());
        const zoom = Number.isFinite(currentZoom) && currentZoom >= 4 ? currentZoom : 7;
        locationPickerMap.easeTo({
            center: lngLat,
            zoom,
            duration: 320
        });
    }
}

function renderPendingLocationSelection() {
    const nameEl = document.getElementById('loc-selected-name');
    const subEl = document.getElementById('loc-selected-sub');
    const altitudeEl = document.getElementById('loc-selected-altitude');
    const coordsEl = document.getElementById('loc-selected-coords');
    const metricsEl = document.getElementById('loc-selected-metrics');
    const confirmBtn = document.getElementById('loc-confirm-btn');

    if (!nameEl || !subEl || !altitudeEl || !coordsEl || !confirmBtn || !metricsEl) return;

    const clearMetrics = () => { metricsEl.innerHTML = ''; };

    if (!pendingLocationSelection) {
        nameEl.textContent = 'None selected';
        subEl.textContent = 'Click on the map or choose a city below.';
        altitudeEl.textContent = 'Altitude: --';
        coordsEl.textContent = '--';
        clearMetrics();
        confirmBtn.disabled = true;
        scheduleLocationNameFit();
        return;
    }

    const system = getUnitSystem();
    const altitudeText = Number.isFinite(pendingLocationSelection.elevation)
        ? `${formatDisplayElevation(pendingLocationSelection.elevation, system)} ${elevationUnit(system)}`
        : '--';

    nameEl.textContent = pendingLocationSelection.name;
    subEl.textContent = getLocationSubtext(pendingLocationSelection);
    altitudeEl.textContent = `Altitude: ${altitudeText}`;
    coordsEl.textContent = `${pendingLocationSelection.lat.toFixed(4)}, ${pendingLocationSelection.lon.toFixed(4)}`;
    confirmBtn.disabled = false;

    if (pendingLocationPreview.status === 'loading') {
        clearMetrics();
        scheduleLocationNameFit();
        return;
    }

    if (pendingLocationPreview.status === 'error') {
        clearMetrics();
        scheduleLocationNameFit();
        return;
    }

    const preview = pendingLocationPreview && pendingLocationPreview.data
        ? pendingLocationPreview.data
        : null;
    if (!preview) {
        clearMetrics();
        scheduleLocationNameFit();
        return;
    }

    const tempMetric = Number(preview.temperature_2m);
    const dewMetric = Number(preview.dew_point_2m);
    const windMetric = Number(preview.wind_speed_10m);

    let impactPct = null;
    if (Number.isFinite(tempMetric) && Number.isFinite(dewMetric) && AppState.hapCalc) {
        const adj = AppState.hapCalc.getAdjustment(tempMetric, dewMetric);
        const impact = ((1.0 / Math.exp(adj)) - 1.0) * 100.0;
        impactPct = Number.isFinite(impact) ? Math.max(0, impact) : null;
    }

    const tempColor = Number.isFinite(tempMetric) ? getCondColor('air', tempMetric) : '#9ca3af';
    const dewColor = Number.isFinite(dewMetric) ? getDewColor(dewMetric) : '#9ca3af';
    const windColor = Number.isFinite(windMetric) ? getCondColor('wind', windMetric) : '#9ca3af';
    const impactColor = Number.isFinite(impactPct) ? getImpactColor(impactPct, tempMetric) : '#9ca3af';

    const tempText = Number.isFinite(tempMetric)
        ? `${formatDisplayTemperature(tempMetric, 1, system)}${temperatureUnit(system)}`
        : '--';
    const dewText = Number.isFinite(dewMetric)
        ? `${formatDisplayTemperature(dewMetric, 1, system)}${temperatureUnit(system)}`
        : '--';
    const windText = Number.isFinite(windMetric)
        ? `${formatDisplayWind(windMetric, 1, system)} ${windUnit(system)}`
        : '--';
    const impactText = Number.isFinite(impactPct)
        ? `${impactPct.toFixed(1)}%`
        : '--';

    const metricInline = (label, value, color) => `
        <div class="loc-metric-inline">
            <div class="loc-metric-inline-label">${label}</div>
            <div class="loc-metric-inline-value" style="--metric-color:${color}">${value}</div>
        </div>
    `;

    metricsEl.innerHTML = [
        metricInline('Temperature', tempText, tempColor),
        metricInline('Dew Point', dewText, dewColor),
        metricInline('Wind', windText, windColor),
        metricInline('Heat Impact', impactText, impactColor)
    ].join('');
    scheduleLocationNameFit();
}

function resetPendingLocationPreview() {
    locationPreviewSeq++;
    pendingLocationPreview = {
        status: 'idle',
        data: null,
        error: null
    };
}

async function resolvePendingSelectionPreview(selection) {
    if (!selection) return;
    const lat = Number(selection.lat);
    const lon = Number(selection.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const coordKey = getLocationCoordKey(lat, lon);
    if (!coordKey) return;

    const seq = ++locationPreviewSeq;
    pendingLocationPreview = {
        status: 'loading',
        data: null,
        error: null
    };
    renderPendingLocationSelection();

    const request = beginRequest(RequestKeys.LOCATION_PREVIEW, {
        abortPrevious: true,
        meta: { lat, lon }
    });
    try {
        const preview = await fetchLocationPreview(lat, lon, { signal: request.signal });
        if (seq !== locationPreviewSeq) return;
        if (!isRequestCurrent(RequestKeys.LOCATION_PREVIEW, request.seq)) return;
        if (!pendingLocationSelection) return;
        if (getLocationCoordKey(pendingLocationSelection.lat, pendingLocationSelection.lon) !== coordKey) return;
        pendingLocationPreview = {
            status: 'ready',
            data: preview,
            error: null
        };
        endRequest(RequestKeys.LOCATION_PREVIEW, request.seq, 'success');
        renderPendingLocationSelection();
    } catch (err) {
        if (err && err.name === 'AbortError') {
            endRequest(RequestKeys.LOCATION_PREVIEW, request.seq, 'aborted');
            return;
        }
        endRequest(
            RequestKeys.LOCATION_PREVIEW,
            request.seq,
            'error',
            err && err.message ? err.message : 'Location preview failed'
        );
        console.error('Location preview fetch failed:', err);
        if (seq !== locationPreviewSeq) return;
        pendingLocationPreview = {
            status: 'error',
            data: null,
            error: err && err.message ? err.message : 'Location preview failed'
        };
        renderPendingLocationSelection();
    }
}

async function resolvePendingSelectionElevation(selection) {
    if (!selection || Number.isFinite(selection.elevation)) return;
    const lat = Number(selection.lat);
    const lon = Number(selection.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const coordKey = getLocationCoordKey(lat, lon);
    if (!coordKey) return;

    if (locationElevationCache.has(coordKey)) {
        const cachedElevation = Number(locationElevationCache.get(coordKey));
        if (!Number.isFinite(cachedElevation)) return;
        if (!pendingLocationSelection) return;
        if (getLocationCoordKey(pendingLocationSelection.lat, pendingLocationSelection.lon) !== coordKey) return;
        pendingLocationSelection.elevation = cachedElevation;
        renderPendingLocationSelection();
        return;
    }

    const seq = ++locationElevationSeq;
    try {
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const elevation = parseElevationPayload(data);
        if (!Number.isFinite(elevation)) return;
        locationElevationCache.set(coordKey, elevation);
        if (seq !== locationElevationSeq) return;
        if (!pendingLocationSelection) return;
        if (getLocationCoordKey(pendingLocationSelection.lat, pendingLocationSelection.lon) !== coordKey) return;
        pendingLocationSelection.elevation = elevation;
        renderPendingLocationSelection();
    } catch (err) {
        console.warn('Elevation lookup failed for pending location:', err);
    }
}

function stageLocationSelection(input, options = {}) {
    const selection = toLocationSelection(input);
    if (!selection) return;

    pendingLocationSelection = selection;
    if (options.activeItem) setActiveLocationSearchItem(options.activeItem);
    else if (options.clearActiveItem) clearActiveLocationSearchItem();

    renderPendingLocationSelection();
    syncMapMarkerToSelection(selection, { recenter: options.recenterMap !== false });
    resolvePendingSelectionElevation(selection);
    resolvePendingSelectionPreview(selection);
}

function resetLocationSelectionState() {
    locationElevationSeq++;
    cancelRequest(RequestKeys.LOCATION_PREVIEW, 'location selection reset');
    pendingLocationSelection = null;
    clearActiveLocationSearchItem();
    resetPendingLocationPreview();
    renderPendingLocationSelection();
}

async function ensureMapLibreLoaded() {
    if (window.maplibregl && typeof window.maplibregl.Map === 'function') return window.maplibregl;
    if (mapLibreLoaderPromise) return mapLibreLoaderPromise;

    mapLibreLoaderPromise = new Promise((resolve, reject) => {
        let cssEl = document.getElementById(MAPLIBRE_CSS_ID);
        if (!cssEl) {
            cssEl = document.createElement('link');
            cssEl.id = MAPLIBRE_CSS_ID;
            cssEl.rel = 'stylesheet';
            cssEl.href = MAPLIBRE_CSS_URL;
            document.head.appendChild(cssEl);
        }

        const existingScript = document.getElementById(MAPLIBRE_SCRIPT_ID);
        if (existingScript && window.maplibregl && typeof window.maplibregl.Map === 'function') {
            resolve(window.maplibregl);
            return;
        }

        const script = existingScript || document.createElement('script');
        script.id = MAPLIBRE_SCRIPT_ID;
        script.src = MAPLIBRE_SCRIPT_URL;
        script.async = true;
        script.onload = () => {
            if (window.maplibregl && typeof window.maplibregl.Map === 'function') resolve(window.maplibregl);
            else reject(new Error('MapLibre loaded without map API'));
        };
        script.onerror = () => reject(new Error('Failed to load MapLibre assets'));
        if (!existingScript) document.head.appendChild(script);
    }).catch((err) => {
        mapLibreLoaderPromise = null;
        throw err;
    });

    return mapLibreLoaderPromise;
}

function updateMapReadout(lngLat) {
    if (!lngLat) {
        setLocationMapReadout('Lat -- | Lon --');
        return;
    }
    const lat = Number(lngLat.lat);
    const lon = Number(lngLat.lng);
    const latText = Number.isFinite(lat) ? lat.toFixed(4) : '--';
    const lonText = Number.isFinite(lon) ? lon.toFixed(4) : '--';
    setLocationMapReadout(`Lat ${latText} | Lon ${lonText}`);
}

async function ensureLocationMapPicker() {
    const panel = document.getElementById('loc-map-panel');
    const canvas = document.getElementById('loc-map');
    if (!panel || !canvas) return;

    if (!isDesktopMapPickerViewport()) {
        panel.setAttribute('aria-hidden', 'true');
        return;
    }

    panel.setAttribute('aria-hidden', 'false');
    setLocationMapStatus('Loading map...');

    let maplibregl = null;
    try {
        maplibregl = await ensureMapLibreLoaded();
    } catch (err) {
        console.error('Location map init failed (MapLibre load):', err);
        setLocationMapStatus('Map unavailable right now. Please use text search.', 'error');
        return;
    }

    if (!locationPickerMap) {
        locationPickerMap = new maplibregl.Map({
            container: canvas,
            style: LOCATION_MAP_BASE_STYLE,
            center: [-48.5495, -27.5969],
            zoom: 4,
            minZoom: 2,
            maxZoom: 13,
            attributionControl: false
        });

        locationPickerMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        const onMapReady = () => {
            setLocationMapStatus('Click on the map to pick a city.', 'ready');
        };
        locationPickerMap.once('load', onMapReady);
        if (typeof locationPickerMap.isStyleLoaded === 'function' && locationPickerMap.isStyleLoaded()) {
            onMapReady();
        }
    }

    const currentLoc = AppState.locManager && AppState.locManager.current
        ? AppState.locManager.current
        : { lat: -27.5969, lon: -48.5495 };
    const curLat = Number(currentLoc.lat);
    const curLon = Number(currentLoc.lon);

    if (Number.isFinite(curLat) && Number.isFinite(curLon)) {
        const currentZoom = Number(locationPickerMap.getZoom());
        const zoom = Number.isFinite(currentZoom) && currentZoom >= 4 ? currentZoom : 6;
        locationPickerMap.jumpTo({ center: [curLon, curLat], zoom });
        if (!locationPickerMarker) {
            locationPickerMarker = new maplibregl.Marker({ color: '#60a5fa' })
                .setLngLat([curLon, curLat])
                .addTo(locationPickerMap);
        } else {
            locationPickerMarker.setLngLat([curLon, curLat]);
        }
        updateMapReadout({ lat: curLat, lng: curLon });
    }

    if (pendingLocationSelection) {
        syncMapMarkerToSelection(pendingLocationSelection, { recenter: true });
        updateMapReadout({ lat: pendingLocationSelection.lat, lng: pendingLocationSelection.lon });
    }

    if (!locationPickerMapClickHandler) {
        locationPickerMapClickHandler = async (evt) => {
            const mapLat = Number(evt.lngLat.lat);
            const mapLon = Number(evt.lngLat.lng);
            if (!Number.isFinite(mapLat) || !Number.isFinite(mapLon)) return;

            stageLocationSelection(
                { lat: mapLat, lon: mapLon, name: 'Pinned Location', country: '', region: '' },
                { clearActiveItem: true, recenterMap: true }
            );

            setLocationMapStatus('Resolving city from clicked point...');
            updateMapReadout(evt.lngLat);

            const seq = ++locationPickerReverseSeq;
            const request = beginRequest(RequestKeys.REVERSE_GEOCODE, {
                abortPrevious: true,
                meta: { source: 'location_map', lat: mapLat, lon: mapLon }
            });
            try {
                const geo = await reverseGeocode(mapLat, mapLon, { signal: request.signal });
                if (seq !== locationPickerReverseSeq || !isRequestCurrent(RequestKeys.REVERSE_GEOCODE, request.seq)) return;

                const name = (geo && geo.name) ? geo.name : 'Pinned Location';
                const country = (geo && geo.country) ? geo.country : '';
                const region = (geo && geo.region) ? geo.region : '';

                endRequest(RequestKeys.REVERSE_GEOCODE, request.seq, 'success');
                setLocationMapStatus(`Selected: ${name}${region ? `, ${region}` : ''}`, 'ready');
                stageLocationSelection(
                    { lat: mapLat, lon: mapLon, name, country, region },
                    { clearActiveItem: true, recenterMap: false }
                );
            } catch (err) {
                if (err && err.name === 'AbortError') {
                    endRequest(RequestKeys.REVERSE_GEOCODE, request.seq, 'aborted');
                    return;
                }
                endRequest(
                    RequestKeys.REVERSE_GEOCODE,
                    request.seq,
                    'error',
                    err && err.message ? err.message : 'Map reverse geocode failed'
                );
                console.error('Location map reverse geocode failed:', err);
                setLocationMapStatus('Could not resolve this point. Try another click.', 'error');
            }
        };
        locationPickerMap.on('click', locationPickerMapClickHandler);
    }

    if (!locationPickerMapMoveHandler) {
        locationPickerMapMoveHandler = (evt) => updateMapReadout(evt.lngLat);
        locationPickerMap.on('mousemove', locationPickerMapMoveHandler);
    }

    if (!locationPickerMapLeaveHandler) {
        locationPickerMapLeaveHandler = () => {
            if (pendingLocationSelection) {
                updateMapReadout({ lat: pendingLocationSelection.lat, lng: pendingLocationSelection.lon });
            } else {
                setLocationMapReadout('Lat -- | Lon --');
            }
        };
        locationPickerMap.on('mouseleave', locationPickerMapLeaveHandler);
    }

    locationPickerMap.resize();
    setLocationMapStatus('Click on the map to pick a city.', 'ready');
}

function restoreFocusOutsideModal(modal, preferredTarget) {
    if (!modal || !modal.contains(document.activeElement)) return;

    const fallbackTarget = document.querySelector('[data-action="location-modal"]');
    const focusTarget = (preferredTarget && document.contains(preferredTarget))
        ? preferredTarget
        : fallbackTarget;

    if (focusTarget && typeof focusTarget.focus === 'function') {
        try {
            focusTarget.focus({ preventScroll: true });
        } catch {
            focusTarget.focus();
        }
        return;
    }

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
}

// Backward compatibility: older cached main bundles may still call this.
export function initBottomNav() {
    // Bottom nav was removed. Keep no-op to avoid runtime crashes on stale caches.
}

function setChartCardCollapsedState(wrapper, collapsed) {
    const card = wrapper?.closest('.forecast-card');
    if (!card) return;
    card.classList.toggle('chart-card-collapsed', collapsed);
}

function supportsHoverPointer() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function prefersSheetTooltip() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

function isMobilePaceFocusViewport() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(max-width: 860px)').matches;
}

function escapeAttr(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function setHoverPaceText(el, showKmh) {
    if (!el) return;
    const base = el.dataset.paceDefault || '';
    const kmh = el.dataset.paceKmh || base;
    el.textContent = showKmh ? kmh : base;
}

function bindPaceHoverInteractions(root) {
    if (!root) return;
    const isHoverMode = supportsHoverPointer();
    root.querySelectorAll('.pace-hover-value').forEach((el) => {
        if (!el.dataset.paceDefault) {
            el.dataset.paceDefault = (el.textContent || '').trim();
        }
        setHoverPaceText(el, false);
        if (el.dataset.hoverBound === '1') return;

        if (isHoverMode) {
            el.addEventListener('mouseenter', () => setHoverPaceText(el, true));
            el.addEventListener('mouseleave', () => setHoverPaceText(el, false));
            el.addEventListener('focus', () => setHoverPaceText(el, true));
            el.addEventListener('blur', () => setHoverPaceText(el, false));
        } else {
            el.dataset.paceMobileState = 'base';
            el.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                const nextIsKmh = el.dataset.paceMobileState !== 'kmh';
                setHoverPaceText(el, nextIsKmh);
                el.dataset.paceMobileState = nextIsKmh ? 'kmh' : 'base';
                if (typeof el.blur === 'function') el.blur();
            });
        }

        el.dataset.hoverBound = '1';
    });
}

function buildThresholdRangeTooltipHtml(el) {
    const thresholdSafe = el?.getAttribute('data-threshold-safe') || '';
    const thresholdMedian = el?.getAttribute('data-threshold-median') || '';
    const thresholdRange = el?.getAttribute('data-threshold-range') || '';
    const cvSafe = el?.getAttribute('data-cv-safe') || '';
    const cvMedian = el?.getAttribute('data-cv-median') || '';
    const cvRange = el?.getAttribute('data-cv-range') || '';
    const vo2Safe = el?.getAttribute('data-vo2-safe') || '';
    const vo2Median = el?.getAttribute('data-vo2-median') || '';
    const vo2Range = el?.getAttribute('data-vo2-range') || '';

    if (!thresholdSafe || !thresholdMedian || !thresholdRange || !cvSafe || !cvMedian || !cvRange || !vo2Safe || !vo2Median || !vo2Range) {
        return '';
    }

    return `
        <table class="threshold-tooltip-table" role="presentation">
            <thead>
                <tr>
                    <th></th>
                    <th>Safe</th>
                    <th>Median</th>
                    <th>Range</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <th>Threshold</th>
                    <td>${thresholdSafe}</td>
                    <td>${thresholdMedian}</td>
                    <td>${thresholdRange}</td>
                </tr>
                <tr>
                    <th>CV</th>
                    <td>${cvSafe}</td>
                    <td>${cvMedian}</td>
                    <td>${cvRange}</td>
                </tr>
                <tr>
                    <th>VO2max</th>
                    <td>${vo2Safe}</td>
                    <td>${vo2Median}</td>
                    <td>${vo2Range}</td>
                </tr>
            </tbody>
        </table>
    `;
}

function getThresholdRangeTooltipKey(el) {
    if (!el) return 'threshold-range';
    return [
        'threshold-range',
        el.getAttribute('data-threshold-safe') || '',
        el.getAttribute('data-threshold-median') || '',
        el.getAttribute('data-threshold-range') || '',
        el.getAttribute('data-cv-safe') || '',
        el.getAttribute('data-cv-median') || '',
        el.getAttribute('data-cv-range') || '',
        el.getAttribute('data-vo2-safe') || '',
        el.getAttribute('data-vo2-median') || '',
        el.getAttribute('data-vo2-range') || ''
    ].join('__');
}

function setThresholdRangeTooltipState(el, trainingPaces, system) {
    if (!el) return;
    const clearKeys = [
        'data-threshold-safe',
        'data-threshold-median',
        'data-threshold-range',
        'data-cv-safe',
        'data-cv-median',
        'data-cv-range',
        'data-vo2-safe',
        'data-vo2-median',
        'data-vo2-range'
    ];

    if (!trainingPaces) {
        clearKeys.forEach((key) => el.removeAttribute(key));
        el.classList.remove('vdot-threshold-range-enabled');
        el.removeAttribute('aria-haspopup');
        el.removeAttribute('aria-label');
        return;
    }

    const formatRangePaceOnly = (secPerKm) => formatPace(secPerKm, formatTime, system).split('/')[0];
    const formatRange = (fastSecPerKm, slowSecPerKm) => `${formatRangePaceOnly(fastSecPerKm)} - ${formatRangePaceOnly(slowSecPerKm)}`;

    el.setAttribute('data-threshold-safe', formatPace(trainingPaces.threshold.safeSecPerKm, formatTime, system));
    el.setAttribute('data-threshold-median', formatPace(trainingPaces.threshold.medianSecPerKm, formatTime, system));
    el.setAttribute('data-threshold-range', formatRange(trainingPaces.threshold.rangeFastSecPerKm, trainingPaces.threshold.rangeSlowSecPerKm));

    el.setAttribute('data-cv-safe', formatPace(trainingPaces.cv.safeSecPerKm, formatTime, system));
    el.setAttribute('data-cv-median', formatPace(trainingPaces.cv.medianSecPerKm, formatTime, system));
    el.setAttribute('data-cv-range', formatRange(trainingPaces.cv.rangeFastSecPerKm, trainingPaces.cv.rangeSlowSecPerKm));

    el.setAttribute('data-vo2-safe', formatPace(trainingPaces.vo2max.safeSecPerKm, formatTime, system));
    el.setAttribute('data-vo2-median', formatPace(trainingPaces.vo2max.medianSecPerKm, formatTime, system));
    el.setAttribute('data-vo2-range', formatRange(trainingPaces.vo2max.rangeFastSecPerKm, trainingPaces.vo2max.rangeSlowSecPerKm));

    el.classList.add('vdot-threshold-range-enabled');
    el.setAttribute('aria-haspopup', 'dialog');
    el.setAttribute('aria-label', 'Show threshold pace range details');
}

function bindThresholdRangeTooltip(el) {
    if (!el || el.dataset.thresholdRangeBound === '1') return;
    let lastTouchOpenTs = 0;

    const onEnter = (evt) => {
        if (!supportsHoverPointer()) return;
        const html = buildThresholdRangeTooltipHtml(el);
        if (!html) return;
        showForeTooltip(evt, html);
        const active = document.getElementById('forecast-tooltip');
        if (active) active.classList.add('forecast-tooltip--training-model');
    };
    const onMove = (evt) => {
        if (!supportsHoverPointer()) return;
        if (!el.hasAttribute('data-threshold-safe')) return;
        moveForeTooltip(evt);
    };
    const onLeave = () => {
        const active = document.getElementById('forecast-tooltip');
        if (active) active.classList.remove('forecast-tooltip--training-model');
        hideForeTooltip();
    };
    const onMobilePress = (evt) => {
        const now = Date.now();
        const isTouchLikeEvent = evt?.type === 'touchend';
        if (evt?.type === 'click' && (now - lastTouchOpenTs) < 500) return;
        if (isTouchLikeEvent) lastTouchOpenTs = now;

        if (!el.hasAttribute('data-threshold-safe')) return;
        const tableHtml = buildThresholdRangeTooltipHtml(el);
        if (!tableHtml) return;

        evt.preventDefault();
        evt.stopPropagation();

        const contentKey = getThresholdRangeTooltipKey(el);
        const active = document.getElementById('forecast-tooltip');
        if (active && active.style.opacity === '1' && active.dataset.currentKey === contentKey) {
            hideForeTooltip();
            return;
        }

        const html = tableHtml;
        const useSheet = prefersSheetTooltip() || isTouchLikeEvent;
        showForeTooltip(evt, html, { preferSheet: useSheet });
        const tooltip = document.getElementById('forecast-tooltip');
        if (!tooltip) return;
        tooltip.classList.add('forecast-tooltip--training-model');
        tooltip.dataset.currentKey = contentKey;
    };
    const onMobileKeyDown = (evt) => {
        if (evt.key !== 'Enter' && evt.key !== ' ') return;
        onMobilePress(evt);
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('touchend', onMobilePress, { passive: false });
    el.addEventListener('click', onMobilePress);
    el.addEventListener('keydown', onMobileKeyDown);
    el.dataset.thresholdRangeBound = '1';
}

function bindPaceCarousel(root) {
    if (!root) return;
    root.querySelectorAll('.pace-carousel').forEach((carousel) => {
        if (carousel.dataset.bound === '1') return;
        const track = carousel.querySelector('.pace-carousel-track');
        const dots = Array.from(carousel.querySelectorAll('.pace-carousel-dot'));
        if (!track || dots.length === 0) {
            carousel.dataset.bound = '1';
            return;
        }

        const setActiveDot = (index) => {
            dots.forEach((dot, i) => {
                dot.classList.toggle('is-active', i === index);
            });
        };

        const getIndex = () => {
            if (!track.clientWidth) return 0;
            return Math.round(track.scrollLeft / track.clientWidth);
        };

        let raf = 0;
        track.addEventListener('scroll', () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                setActiveDot(getIndex());
            });
        }, { passive: true });

        dots.forEach((dot) => {
            dot.addEventListener('click', (evt) => {
                evt.preventDefault();
                const index = Number.parseInt(dot.dataset.slideIndex || '0', 10);
                if (!Number.isFinite(index) || index < 0) return;
                track.scrollTo({
                    left: track.clientWidth * index,
                    behavior: 'smooth'
                });
                setActiveDot(index);
            });
        });

        setActiveDot(getIndex());
        carousel.dataset.bound = '1';
    });
}


// --- Chart Toggle Functions ---
export function toggleTempChart() {
    const wrapper = document.getElementById('temp-chart-wrapper');
    const icon = document.getElementById('temp-toggle-icon');
    if (!wrapper || !icon) return;

    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
        setChartCardCollapsedState(wrapper, false);
        saveToStorage('temp_chart_collapsed', false);
        renderForecastChart('forecast-chart-container-16', 14);
    } else {
        wrapper.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
        setChartCardCollapsedState(wrapper, true);
        saveToStorage('temp_chart_collapsed', true);
    }
}

// Restore Temp Chart State
const savedTempState = loadFromStorage('temp_chart_collapsed');
if (savedTempState === true) {
    const wrapper = document.getElementById('temp-chart-wrapper');
    const icon = document.getElementById('temp-toggle-icon');
    if (wrapper) wrapper.style.display = 'none';
    if (wrapper) setChartCardCollapsedState(wrapper, true);
    if (icon) icon.style.transform = 'rotate(-90deg)';
}

export function toggleWindChart() {
    const wrapper = document.getElementById('wind-chart-wrapper');
    const icon = document.getElementById('wind-toggle-icon');
    if (!wrapper || !icon) return;

    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
        setChartCardCollapsedState(wrapper, false);
        saveToStorage('wind_chart_collapsed', false);
        renderWindChart('forecast-wind-chart-container-16', 14);
    } else {
        wrapper.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
        setChartCardCollapsedState(wrapper, true);
        saveToStorage('wind_chart_collapsed', true);
    }
}

// Restore Wind Chart State
const savedWindState = loadFromStorage('wind_chart_collapsed');
if (savedWindState === true) {
    const wrapper = document.getElementById('wind-chart-wrapper');
    const icon = document.getElementById('wind-toggle-icon');
    if (wrapper) wrapper.style.display = 'none';
    if (wrapper) setChartCardCollapsedState(wrapper, true);
    if (icon) icon.style.transform = 'rotate(-90deg)';
}

export function toggleRainChart() {
    const wrapper = document.getElementById('rain-chart-wrapper');
    const icon = document.getElementById('rain-toggle-icon');
    if (!wrapper || !icon) return;

    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
        setChartCardCollapsedState(wrapper, false);
        saveToStorage('rain_chart_collapsed', false);
        renderRainChart('forecast-rain-chart-container-16', 14);
    } else {
        wrapper.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
        setChartCardCollapsedState(wrapper, true);
        saveToStorage('rain_chart_collapsed', true);
    }
}

// Restore Rain Chart State
const savedRainState = loadFromStorage('rain_chart_collapsed');
if (savedRainState === true) {
    const wrapper = document.getElementById('rain-chart-wrapper');
    const icon = document.getElementById('rain-toggle-icon');
    if (wrapper) wrapper.style.display = 'none';
    if (wrapper) setChartCardCollapsedState(wrapper, true);
    if (icon) icon.style.transform = 'rotate(-90deg)';
}


// --- Favorites / Quick Switch UI ---
export function toggleLocationFavorite() {
    AppState.locManager.toggleFavorite();
    updateFavoriteStar();
}

export function toggleLocationDropdown(arg) {
    let trigger = (arg && arg.nodeType === 1) ? arg : (arg && arg.currentTarget ? arg.currentTarget : null);
    if (arg && arg.stopPropagation) arg.stopPropagation();
    const triggerWrapper = trigger ? trigger.closest('.location-group') : null;
    const triggerHeader = triggerWrapper ? triggerWrapper.closest('.header') : null;
    const setDropdownOpenState = (open) => {
        if (triggerWrapper) triggerWrapper.classList.toggle('location-group--dropdown-open', open);
        if (triggerHeader) triggerHeader.classList.toggle('header--dropdown-open', open);
    };

    let dropdown = document.getElementById('location-dropdown');
    if (trigger) {
        if (triggerWrapper) {
            const found = triggerWrapper.querySelector('.dropdown-menu');
            if (found) dropdown = found;
        }
    }

    if (!dropdown) return;

    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
        setDropdownOpenState(false);
        return;
    }

    // Ensure only one dropdown stacking context stays open.
    document.querySelectorAll('.location-group--dropdown-open')
        .forEach((el) => el.classList.remove('location-group--dropdown-open'));
    document.querySelectorAll('.header--dropdown-open')
        .forEach((el) => el.classList.remove('header--dropdown-open'));

    // Render & Show
    dropdown.innerHTML = '';

    // Favorites
    if (AppState.locManager.favorites.length > 0) {
        const hFav = document.createElement('div');
        hFav.className = 'dropdown-header';
        hFav.textContent = 'Favorites';
        dropdown.appendChild(hFav);

        AppState.locManager.favorites.forEach(fav => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            appendLocationLabel(item, fav.name, getLocationSubtext(fav), 'sub');
            item.onclick = () => {
                AppState.locManager.setLocation(fav.lat, fav.lon, fav.name, fav.country, { region: fav.region || '' });
                dropdown.style.display = 'none';
                setDropdownOpenState(false);
            };
            dropdown.appendChild(item);
        });

        const div = document.createElement('div');
        div.className = 'dropdown-divider';
        dropdown.appendChild(div);
    }

    // Recents
    const recentsToUse = AppState.locManager.recents.filter(r => !AppState.locManager.isFavorite(r)).slice(0, 5);
    if (recentsToUse.length > 0) {
        const hRec = document.createElement('div');
        hRec.className = 'dropdown-header';
        hRec.textContent = 'Recent';
        dropdown.appendChild(hRec);

        recentsToUse.forEach(rec => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            appendLocationLabel(item, rec.name, getLocationSubtext(rec), 'sub');
            item.onclick = () => {
                AppState.locManager.setLocation(rec.lat, rec.lon, rec.name, rec.country, { region: rec.region || '' });
                dropdown.style.display = 'none';
                setDropdownOpenState(false);
            };
            dropdown.appendChild(item);
        });

        const div = document.createElement('div');
        div.className = 'dropdown-divider';
        dropdown.appendChild(div);
    }

    // Search Option
    const searchItem = document.createElement('div');
    searchItem.className = 'dropdown-item dropdown-item-search';
    searchItem.innerHTML = `<span class="dropdown-search-label"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Search...</span>`;
    searchItem.onclick = () => {
        dropdown.style.display = 'none';
        setDropdownOpenState(false);
        openLocationModal();
    };
    dropdown.appendChild(searchItem);

    dropdown.style.display = 'block';
    setDropdownOpenState(true);

    // Click outside to close
    const closeMenu = (e) => {
        if (!dropdown.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
            dropdown.style.display = 'none';
            setDropdownOpenState(false);
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

export function updateFavoriteStar() {
    if (!AppState.locManager) return;
    const isFav = AppState.locManager.isFavorite();
    document.querySelectorAll('.btn-favorite').forEach(btn => {
        const svg = btn.querySelector('svg');
        if (isFav) {
            btn.classList.add('star-active');
            if (svg) { svg.style.fill = 'currentColor'; svg.style.stroke = 'currentColor'; }
            btn.style.opacity = '1';
        } else {
            btn.classList.remove('star-active');
            if (svg) { svg.style.fill = 'none'; svg.style.stroke = 'currentColor'; }
            btn.style.opacity = '0.5';
        }
    });
}

// FAB Click Listener
document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('fab-refresh');
    if (fab) {
        fab.addEventListener('click', async () => {
            if (AppState.refreshWeather) {
                fab.classList.add('fab-spin');
                await AppState.refreshWeather(true);
                setTimeout(() => fab.classList.remove('fab-spin'), 1000);
            }
        });
    }
});

export function toggleDarkMode() {
    AppStore.dispatch(StoreActions.patchUI({ isDark: !UIState.isDark }));
    if (UIState.isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    renderClimateHeatmap();
}

export function setForecastData(d) {
    AppStore.dispatch(StoreActions.setForecastData(d));
}
export function setClimateData(d) {
    AppStore.dispatch(StoreActions.setClimateData(d));
}


// --- VDOT Gauge ---
function getAgeGradeColor(score) {
    if (score >= 100) return '#f59e0b'; // Gold - World Record
    if (score >= 90) return '#7c3aed'; // Purple - World Class
    if (score >= 80) return '#3b82f6'; // Blue - National Class
    if (score >= 70) return '#22c55e'; // Green - Regional Class
    if (score >= 60) return '#f97316'; // Orange - Local Class
    return '#ef4444';                  // Red - Below
}

function getAgeGradeLabel(score) {
    if (score >= 100) return 'World Record';
    if (score >= 90) return 'World Class';
    if (score >= 80) return 'National Class';
    if (score >= 70) return 'Regional Class';
    if (score >= 60) return 'Local Class';
    return '';
}

export function updateVDOTGauge(vdot, ageGradeScore) {
    const arc = document.getElementById('vdot-gauge-arc');
    const label = document.getElementById('vdot-gauge-label');
    if (!arc) return;

    // Arc total length = π * r = π * 50 ≈ 157
    const ARC_LENGTH = 157;

    let fillPercent, color;

    if (ageGradeScore !== null && ageGradeScore !== undefined) {
        // Use age grade score (0-100) for arc fill and color
        fillPercent = Math.min(ageGradeScore / 100, 1);
        color = getAgeGradeColor(ageGradeScore);
        const gradeLabel = getAgeGradeLabel(ageGradeScore);

        if (label) {
            label.textContent = gradeLabel;
            label.style.color = color;
        }
    } else {
        // Fallback: use VDOT range (30-85) for arc fill
        const minVDOT = 30, maxVDOT = 85;
        fillPercent = Math.min(Math.max((vdot - minVDOT) / (maxVDOT - minVDOT), 0), 1);
        color = 'var(--accent-color)';

        if (label) {
            label.textContent = '';
        }
    }

    const offset = ARC_LENGTH * (1 - fillPercent);
    arc.style.strokeDashoffset = offset;
    arc.style.stroke = color;
    arc.style.filter = `drop-shadow(0 0 6px ${color})`;
}

// --- Helpers ---
// date/time format helpers
// formatTime imported from core.js


export function showInfoTooltip(e, title, text) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const preferSheet = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: none), (pointer: coarse)').matches;

    const contentKey = `${title || ''}__${text || ''}`;
    const el = document.getElementById('forecast-tooltip');
    // Toggle: if already showing this tooltip, hide it
    if (el && el.style.opacity === '1' && el.dataset.currentKey === contentKey) {
        hideForeTooltip();
        return;
    }

    const titleHtml = title ? `<div class="tooltip-header">${title}</div>` : '';
    const html = `
                        ${titleHtml}
                        <div class="tooltip-content-body">${text}</div>
                    `;

    showForeTooltip(e, html, { preferSheet });
    const activeTooltip = document.getElementById('forecast-tooltip');
    if (!activeTooltip) return;
    if (!preferSheet) {
        const maxWidth = Math.min(360, window.innerWidth - 16);
        activeTooltip.style.maxWidth = `${maxWidth}px`;
    }
    activeTooltip.dataset.currentKey = contentKey;

    if (preferSheet) return;

    const anchor = e && e.target && typeof e.target.closest === 'function'
        ? e.target.closest('[data-action="info-tooltip"]')
        : null;
    const anchorRect = anchor ? anchor.getBoundingClientRect() : null;
    const hasMousePoint = Number.isFinite(e?.clientX) && Number.isFinite(e?.clientY) && !(e.clientX === 0 && e.clientY === 0);
    const pointerX = hasMousePoint
        ? e.clientX
        : (anchorRect ? (anchorRect.left + (anchorRect.width / 2)) : (window.innerWidth / 2));
    const pointerY = hasMousePoint
        ? e.clientY
        : (anchorRect ? (anchorRect.bottom + 8) : (window.innerHeight / 2));
    const rect = activeTooltip.getBoundingClientRect();

    // Position
    let left = pointerX + 10;
    if ((left + rect.width) > (window.innerWidth - 8)) {
        left = window.innerWidth - rect.width - 8;
    }
    if (left < 8) left = 8;

    let top = pointerY + 12;
    if ((top + rect.height) > (window.innerHeight - 8)) {
        top = pointerY - rect.height - 12;
    }
    if (top < 8) top = 8;

    activeTooltip.style.left = left + 'px';
    activeTooltip.style.top = top + 'px';
}

export function toggleForeSelection(isoTime, e) {
    if (e) e.stopPropagation();
    let nextHour = null;
    if (isoTime !== null) {
        nextHour = (UIState.selectedForeHour === isoTime) ? null : isoTime;
    }
    AppStore.dispatch(StoreActions.patchUI({
        selectedForeHour: nextHour
    }));
    renderAllForecasts({ selection: true });
}

export function toggleVDOTDetails(e) {
    const el = document.getElementById('vdot-details');
    const card = document.getElementById('vdot-card');
    const trigger = document.querySelector('#vdot-card .vdot-header[data-action="vdot-details"]');
    if (!el) return;
    // If click originated from within the details panel, don't toggle
    if (e && e.target && el.contains(e.target)) return;
    const isHidden = getComputedStyle(el).display === 'none';
    if (isHidden) {
        el.style.display = 'block';
        if (card) card.classList.add('vdot-expanded');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        renderVDOTDetails();
    } else {
        el.style.display = 'none';
        if (card) card.classList.remove('vdot-expanded');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
}

// Altitude Impact Card Renderer
export function renderAltitudeCard() {
    const card = document.getElementById('altitude-impact-card');
    if (!card) return;

    const baseAlt = AppState.altitude.base || 0;
    const currentAlt = AppState.altitude.current || 0;
    const delta = currentAlt - baseAlt;
    const absDelta = Math.abs(delta);

    // Only show if at least 100m difference
    if (absDelta < 100) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'flex';
    card.classList.add('impact-status-card');

    const altitudeInfo = infoIcon(
        '',
        'Pace adjustment from altitude by &lt;a href=&quot;https://pubmed.ncbi.nlm.nih.gov/16311764/&quot; target=&quot;_blank&quot;&gt;Wehrlin &amp; Hallén (2006)&lt;/a&gt; for ascending, &lt;a href=&quot;https://pubmed.ncbi.nlm.nih.gov/9216951/&quot; target=&quot;_blank&quot;&gt;Levine &amp; Stray-Gundersen (1997)&lt;/a&gt; for descending.',
        'info-tooltip-trigger--card-corner'
    );

    import('./altitude.js').then(({ AltitudeCalc }) => {
        const isAscending = delta > 0;

        if (isAscending) {
            // Going UP - pace penalty
            const impact = AltitudeCalc.getAltitudeImpact(baseAlt, currentAlt);

            if (impact.impactPct > 0.5) {
                card.style.display = 'flex';
                card.innerHTML = `<div class="impact-status-copy">Altitude<br><span class="impact-note-value impact-note-value--headwind">~${impact.impactPct.toFixed(1)}% slowdown</span></div>${altitudeInfo}`;
            } else {
                card.style.display = 'none';
            }
        } else {
            // Going DOWN - pace boost
            const boost = AltitudeCalc.calculateDescentBoost(300, baseAlt, currentAlt); // Use ref pace

            if (boost.gainPercent > 0.5) {
                card.style.display = 'flex';
                card.innerHTML = `<div class="impact-status-copy">Altitude<br><span class="impact-note-value impact-note-value--tailwind">~${boost.gainPercent.toFixed(1)}% faster</span></div>${altitudeInfo}`;
            } else {
                card.style.display = 'none';
            }
        }
    });
}

export function handleChartHover(e, totalW, chartW, padLeft, dataLen) {
    const rect = e.target.getBoundingClientRect();
    // Adjust mouseX to be relative to the chart area (padLeft offset)
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const len = dataLen || UIState.forecastData.length;
    let idx = Math.round(ratio * (len - 1));
    idx = Math.max(0, Math.min(idx, len - 1)); // Clamp to bounds

    if (idx >= 0 && idx < UIState.forecastData.length) {
        const d = UIState.forecastData[idx];
        const date = new Date(d.time);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        const hourStr = d.time.substring(11, 13);

        const type = e.target.getAttribute('data-type'); // Check chart type

        let html = '';
        const system = getUnitSystem();
        const tempUnitLabel = temperatureUnit(system);
        const windUnitLabel = windUnit(system);
        const precipUnitLabel = precipitationUnit(system);

        if (type === 'rain') {
            // Rain Tooltip
            html = `
                <div class="tooltip-header">${dayName} ${dateStr} ${hourStr}:00</div>
                <div class="tooltip-row"><span class="tooltip-label">Rain:</span> <span class="tooltip-val tooltip-val--rain">${d.rain != null ? formatDisplayPrecip(d.rain, 1, 2, system) : '0.0'} ${precipUnitLabel}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Prob:</span> <span class="tooltip-val tooltip-val--prob">${d.prob != null ? d.prob : '0'}%</span></div>
            `;
        } else if (type === 'wind') {
            // Wind Tooltip
            const getCardinal = (angle) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(angle / 45) % 8];
            const dirStr = getCardinal(d.dir || 0);
            html = `
                <div class="tooltip-header">${dayName} ${dateStr} ${hourStr}:00</div>
                <div class="tooltip-row"><span class="tooltip-label">Wind:</span> <span class="tooltip-val tooltip-val--wind">${d.wind != null ? formatDisplayWind(d.wind, 1, system) : '0'} ${windUnitLabel}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Dir:</span> <span class="tooltip-val tooltip-val--dir">${dirStr}</span></div>
            `;
        } else {
            // Standard Temp/Impact Tooltip
            let baseSec = getBasePaceSec();
            const adjPace = AppState.hapCalc ? AppState.hapCalc.calculatePaceInHeat(baseSec, d.temp, d.dew) : baseSec;
            const pct = ((adjPace - baseSec) / baseSec) * 100;
            const color = getImpactColor(pct, d.temp);

            html = `
                <div class="tooltip-header">${dayName} ${dateStr} ${hourStr}:00</div>
                <div class="tooltip-row"><span class="tooltip-label">Temp:</span> <span class="tooltip-val tooltip-val--temp">${d.temp != null ? formatDisplayTemperature(d.temp, 1, system) : '--'} ${tempUnitLabel}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Dew:</span> <span class="tooltip-val tooltip-val--dew">${d.dew != null ? formatDisplayTemperature(d.dew, 1, system) : '--'} ${tempUnitLabel}</span></div>
                <div class="tooltip-row tooltip-row--divider">
                    <span class="tooltip-label">Impact:</span> <span class="tooltip-val tooltip-val--impact" style="--tooltip-impact-color:${color}">${pct.toFixed(2)}%</span>
                </div>
            `;
        }
        showForeTooltip(e, html);
    }
}

export function handleChartClick(e, totalW, chartW, padLeft, dataLen) {
    const rect = e.target.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = mouseX / rect.width; // Fix: Use rendered width, not SVG logic width
    const len = dataLen || UIState.forecastData.length;
    const idx = Math.round(ratio * (len - 1));
    if (idx >= 0 && idx < UIState.forecastData.length) {
        const d = UIState.forecastData[idx];
        toggleForeSelection(d.time, e);
    }
}

export function showClimateTooltip(e, w, h, impact, temp, dew, count) {
    const impactColor = getImpactColor(impact, temp);

    const dateStr = `${getDateFromWeek(w)}`;
    const timeStr = `${String(h).padStart(2, '0')}:00`;
    const system = getUnitSystem();
    const tempUnitLabel = temperatureUnit(system);

    // Exact HTML template as handleCellHover
    // Exact HTML template as handleCellHover
    const html = `
                    <div class="tooltip-header">Week ${w} (${dateStr}) ${timeStr}</div>
                    <div class="tooltip-row"><span class="tooltip-label">Temp:</span> <span class="tooltip-val tooltip-val--temp">${formatDisplayTemperature(temp, 1, system)} ${tempUnitLabel}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Dew:</span> <span class="tooltip-val tooltip-val--dew">${formatDisplayTemperature(dew, 1, system)} ${tempUnitLabel}</span></div>
                    <div class="tooltip-row tooltip-row--divider">
                        <span class="tooltip-label">Impact:</span> <span class="tooltip-val tooltip-val--impact" style="--tooltip-impact-color:${impactColor}">${(impact || 0).toFixed(2)}%</span>
                    </div>
                `;
    showForeTooltip(e, html);
    const tooltip = document.getElementById('forecast-tooltip');
    if (tooltip) tooltip.dataset.currentKey = '';
}

export function moveClimateTooltip(e) {
    moveForeTooltip(e);
}
export function hideClimateTooltip() {
    hideForeTooltip();
}
export function filterClimateByImpact(idx, el) {
    const nextFilter = UIState.climateImpactFilter === idx ? null : idx;
    AppStore.dispatch(StoreActions.patchUI({
        climateImpactFilter: nextFilter
    }));
    if (nextFilter === null) {
        // Clear dimming
        if (el && el.parentElement) el.parentElement.querySelectorAll('.legend-item').forEach(e => e.classList.remove('opacity-20'));
    } else {
        // Set dimming
        if (el && el.parentElement) {
            el.parentElement.querySelectorAll('.legend-item').forEach(e => e.classList.add('opacity-20'));
            el.classList.remove('opacity-20');
        }
    }
    renderClimateHeatmap(); // To dim cells
    renderClimateTable();   // To filter rows
}

export function sortClimate(col) {
    let nextCol = col;
    let nextDir = 'asc';
    if (UIState.climateSortCol === col) {
        nextDir = (UIState.climateSortDir === 'asc') ? 'desc' : 'asc';
    } else {
        nextDir = 'desc'; // Default high impact/temp first
        if (col === 'date' || col === 'hour') nextDir = 'asc';
    }
    AppStore.dispatch(StoreActions.patchUI({
        climateSortCol: nextCol,
        climateSortDir: nextDir
    }));
    renderClimateTable();
}

export function toggleClimateFilter(w, h, e) {
    if (e) e.stopPropagation(); // Essential to prevent document click from clearing selection immediately
    let nextKey = null;
    if (w === null) {
        nextKey = null;
    } else {
        const key = `${w}-${h}`;
        nextKey = (UIState.selectedClimateKey === key) ? null : key;
    }
    AppStore.dispatch(StoreActions.patchUI({
        selectedClimateKey: nextKey
    }));
    // Sync UIState
    renderClimateTable();
    renderClimateHeatmap(); // Update opacity
    renderClimateLegend(); // Update legend
}

export async function fetchIPLocation(originalError) {
    setInlineGpsButtonLoading(true, 'Trying IP location...');
    console.log("Attempting IP Fallback...");

    const request = beginRequest(RequestKeys.IP_LOCATION, { abortPrevious: true });
    try {
        const data = await fetchIpLocation({ signal: request.signal });
        if (!isRequestCurrent(RequestKeys.IP_LOCATION, request.seq)) return;
        if (!data) throw new Error("IP Location failed");
        console.log("IP Location Success:", data);
        stageLocationSelection({
            lat: data.lat,
            lon: data.lon,
            name: data.name || 'My Location',
            country: data.country || '',
            region: '',
            elevation: null
        }, { clearActiveItem: true, recenterMap: true });
        setLocationMapStatus('GPS suggestion ready. Click Confirm location.', 'ready');
        endRequest(RequestKeys.IP_LOCATION, request.seq, 'success');
    } catch (e) {
        if (e && e.name === 'AbortError') {
            endRequest(RequestKeys.IP_LOCATION, request.seq, 'aborted');
            setInlineGpsButtonLoading(false);
            return;
        }
        endRequest(RequestKeys.IP_LOCATION, request.seq, 'error', e && e.message ? e.message : 'IP location failed');
        console.error("IP Fallback failed", e);
        alert(`GPS Failed (${originalError.message}) and IP Location failed. Please search manually.`);
    } finally {
        setInlineGpsButtonLoading(false);
    }
}
export function openLocationModal() {
    console.log("Opening Location Modal...");
    var m = document.getElementById('loc-modal');
    if (m) {
        lastLocationFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const titleEl = m.querySelector('.modal-title');
        if (titleEl && !titleEl.id) titleEl.id = 'loc-modal-title';
        m.setAttribute('role', 'dialog');
        m.setAttribute('aria-modal', 'true');
        m.setAttribute('aria-hidden', 'false');
        m.removeAttribute('inert');
        if (titleEl) m.setAttribute('aria-labelledby', titleEl.id);
        m.classList.add('open');
        scheduleLocationNameFit();
        if (locationSearchDebounceTimer) {
            clearTimeout(locationSearchDebounceTimer);
            locationSearchDebounceTimer = null;
        }
        cancelRequest(RequestKeys.LOCATION_SEARCH, 'modal reopened');
        cancelRequest(RequestKeys.REVERSE_GEOCODE, 'modal reopened');
        locationSearchSeq++;
        locationPickerReverseSeq++;
        resetLocationSelectionState();
        setInlineGpsButtonLoading(false);
        setLocationMapStatus('Click on the map to pick a city.', 'ready');
        // Render Recents if available and search is empty
        var list = document.getElementById('loc-results');
        var searchIn = document.getElementById('loc-search');
        const renderRecents = () => {
            if (!list) return;
            list.innerHTML = '';
            if (AppState.locManager && AppState.locManager.recents && AppState.locManager.recents.length > 0) {
                var header = document.createElement('div');
                header.className = 'loc-section-header';
                header.textContent = "Recent Locations";
                list.appendChild(header);
                AppState.locManager.recents.forEach(function (item) {
                    var div = document.createElement('div');
                    div.className = 'loc-item';
                    appendLocationLabel(div, item.name, getLocationSubtext(item), 'loc-sub');
                    div.onclick = function () {
                        locationPickerReverseSeq++;
                        cancelRequest(RequestKeys.REVERSE_GEOCODE, 'list selection');
                        stageLocationSelection(
                            {
                                lat: item.lat,
                                lon: item.lon,
                                name: item.name,
                                country: item.country || '',
                                region: item.region || '',
                                elevation: item.elevation
                            },
                            { activeItem: div, recenterMap: true }
                        );
                        setLocationMapStatus(`Selected: ${item.name}`, 'ready');
                    };
                    list.appendChild(div);
                });
            }
        };

        const renderSearchResults = (results) => {
            if (!list) return;
            list.innerHTML = '';
            if (results && results.length > 0) {
                results.forEach(item => {
                    var div = document.createElement('div');
                    div.className = 'loc-item';
                    var state = item.admin1 || '';
                    var country = item.country || '';
                    appendLocationLabel(div, item.name, getLocationSubtext({ region: state, country }), 'loc-sub');
                    div.onclick = function () {
                        locationPickerReverseSeq++;
                        cancelRequest(RequestKeys.REVERSE_GEOCODE, 'list selection');
                        stageLocationSelection(
                            {
                                lat: item.latitude,
                                lon: item.longitude,
                                name: item.name,
                                country,
                                region: state,
                                elevation: item.elevation
                            },
                            { activeItem: div, recenterMap: true }
                        );
                        setLocationMapStatus(`Selected: ${item.name}`, 'ready');
                    };
                    list.appendChild(div);
                });
            }
        };

        if (list && searchIn) {
            searchIn.value = ''; // Clear search
            renderRecents();
        }
        ensureLocationMapPicker().catch((err) => {
            console.error('Desktop location map setup failed:', err);
            setLocationMapStatus('Map unavailable right now. Please use text search.', 'error');
        });
        setTimeout(function () {
            var i = document.getElementById('loc-search');
            if (i) {
                i.focus();
                // Attach Search Listener if not already attached (or just overwrite oninput)
                i.oninput = async (e) => {
                    const q = (e.target.value || '').trim();
                    const requestId = ++locationSearchSeq;
                    if (locationSearchDebounceTimer) clearTimeout(locationSearchDebounceTimer);

                    if (q.length < 3) {
                        cancelRequest(RequestKeys.LOCATION_SEARCH, 'query too short');
                        renderRecents();
                        return;
                    }

                    locationSearchDebounceTimer = setTimeout(async () => {
                        const req = beginRequest(RequestKeys.LOCATION_SEARCH, {
                            abortPrevious: true,
                            meta: { query: q }
                        });
                        try {
                            const res = await AppState.locManager.searchCity(q, { signal: req.signal });
                            if (requestId !== locationSearchSeq || !isRequestCurrent(RequestKeys.LOCATION_SEARCH, req.seq)) return;
                            renderSearchResults(res);
                            endRequest(RequestKeys.LOCATION_SEARCH, req.seq, 'success');
                        } catch (err) {
                            if (err && err.name === 'AbortError') {
                                endRequest(RequestKeys.LOCATION_SEARCH, req.seq, 'aborted');
                                return;
                            }
                            if (requestId !== locationSearchSeq) return;
                            endRequest(
                                RequestKeys.LOCATION_SEARCH,
                                req.seq,
                                'error',
                                err && err.message ? err.message : 'Location search failed'
                            );
                            console.error("Location search failed", err);
                            if (list) list.innerHTML = '';
                        }
                    }, 220);
                };
            }
            scheduleLocationNameFit();
        }, 100);
    } else {
        console.error("Location Modal not found in DOM");
    }
}
export async function confirmLocationSelection() {
    if (!pendingLocationSelection || !AppState.locManager) return;
    const btn = document.getElementById('loc-confirm-btn');
    const originalLabel = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Confirming...';
    }

    try {
        await AppState.locManager.setLocation(
            pendingLocationSelection.lat,
            pendingLocationSelection.lon,
            pendingLocationSelection.name,
            pendingLocationSelection.country,
            {
                region: pendingLocationSelection.region || '',
                elevation: pendingLocationSelection.elevation
            }
        );
    } finally {
        if (btn) btn.textContent = originalLabel || 'Confirm location';
        renderPendingLocationSelection();
    }
}
export function closeLocationModal(e) {
    var m = document.getElementById('loc-modal');
    if (!m) return;
    const closeBtnTarget = e && e.target && typeof e.target.closest === 'function'
        ? e.target.closest('[data-action="location-close"]')
        : null;
    if (e && e.target !== m && !closeBtnTarget) return;

    restoreFocusOutsideModal(m, lastLocationFocus);
    cancelRequest(RequestKeys.LOCATION_PREVIEW, 'modal closed');
    if (locationNameFitRaf) {
        window.cancelAnimationFrame(locationNameFitRaf);
        locationNameFitRaf = 0;
    }
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
    m.setAttribute('inert', '');
}

export function setupWindowHelpers() {
    console.log("Window Helpers Setup");

    // Global click listener for deselecting
    document.addEventListener('click', (e) => {
        // Ignore clicks on elements that have been removed from DOM (e.g. due to re-renders)
        if (!document.body.contains(e.target)) return;

        // Forecast Deselection
        if (UIState.selectedForeHour) {
            // Updated IDs for 16-day forecast
            const charContainer = document.getElementById('forecast-chart-container-16');
            const rainChart = document.getElementById('forecast-rain-chart-container-16');
            const windChart = document.getElementById('forecast-wind-chart-container-16');
            const legend = document.getElementById('legend-container-16');

            const isOutsideChart = !charContainer || !charContainer.contains(e.target);
            const isOutsideRain = !rainChart || !rainChart.contains(e.target);
            const isOutsideWind = !windChart || !windChart.contains(e.target);
            const isOutsideLegend = !legend || !legend.contains(e.target);


            // Should also ignore clicks on the "Best Run" buttons (but NOT the banner itself, per user request)
            const isOutsideBestButtons = !e.target.closest('.insight-btn');

            // Also check if target is the interaction layer (though inside chart) or specific buttons
            console.log('Click check Forecast:', { isOutsideChart, isOutsideRain, isOutsideWind, isOutsideLegend, isOutsideBestButtons, target: e.target });

            if (isOutsideChart && isOutsideRain && isOutsideWind && isOutsideLegend && isOutsideBestButtons) {
                console.log("Deselecting Forecast");
                toggleForeSelection(null);
            }
        }

        // Climate Deselection
        if (UIState.selectedClimateKey) {
            const cmap = document.getElementById('climate-heatmap-container');
            const cleg = document.getElementById('climate-legend-container'); // Check if this ID is correct in renderers
            if ((!cmap || !cmap.contains(e.target)) && (!cleg || !cleg.contains(e.target))) {
                toggleClimateFilter(null, null);
            }
        }

        // Forecast Impact Filter Deselection (click outside legend/filter)
        if (UIState.selectedImpactFilter) {
            const fLegend = document.getElementById('legend-container-16');
            const clickedForecastFilter = e.target.closest('[data-action="filter-impact"]');
            const clickedInsideForecastLegend = fLegend && fLegend.contains(e.target);
            if (!clickedForecastFilter && !clickedInsideForecastLegend) {
                AppStore.dispatch(StoreActions.patchUI({
                    selectedImpactFilter: null
                }));
                renderAllForecasts({ filter: true });
            }
        }

        // Climate Impact Filter Deselection (click outside legend/filter)
        if (UIState.climateImpactFilter !== null) {
            const cLegend = document.getElementById('climate-legend-container');
            const clickedClimateFilter = e.target.closest('[data-action="filter-climate-impact"]');
            const clickedInsideClimateLegend = cLegend && cLegend.contains(e.target);
            if (!clickedClimateFilter && !clickedInsideClimateLegend) {
                AppStore.dispatch(StoreActions.patchUI({
                    climateImpactFilter: null
                }));
                renderClimateHeatmap();
                renderClimateTable();
                renderClimateLegend();
            }
        }

        // Info Tooltip Dismiss (click outside)
        const tooltip = document.getElementById('forecast-tooltip');
        if (tooltip && tooltip.style.opacity === '1') {
            if (e.__keepTooltipOpen) return;
            // Check if click is on an info icon (has showInfoTooltip onclick)
            const isInfoIcon = e.target.closest('[data-action="info-tooltip"]');
            const isClimateCell = e.target.closest('[data-action="climate-cell"]');
            const isForecastHeatCell = e.target.closest('[data-action="select-forecast"]');
            const isForecastChartLayer = e.target.closest('[data-action="chart-interact"]');
            if (!isInfoIcon && !isClimateCell && !isForecastHeatCell && !isForecastChartLayer && !tooltip.contains(e.target)) {
                hideForeTooltip();
            }
        }
    });

    // Responsive Chart Resizing
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            renderAllForecasts({ layout: true });
            renderClimateHeatmap();
            scheduleLocationNameFit();
        }, 150); // Debounce
    });
}

export function update(els, hapCalc) {
    const system = getUnitSystem();
    const tempMetric = toMetricTemperature(parseFloat(els.temp.value), system);
    const dewMetric = toMetricTemperature(parseFloat(els.dew.value), system);
    const windMetric = toMetricWind(parseFloat(els.wind ? els.wind.value : 0), system);

    // 1. Read Inputs
    const state = {
        distance: parseFloat(els.distance.value) || 0,
        timeSec: parseTime(els.time.value),
        temp: Number.isFinite(tempMetric) ? tempMetric : NaN,
        dew: Number.isFinite(dewMetric) ? dewMetric : NaN,
        wind: Number.isFinite(windMetric) ? windMetric : 0,
        runnerWeight: AppState.runner.weight || 65,
        age: parseInt(els.age ? els.age.value : 0),
        gender: els.gender ? els.gender.value : '',
        baseAltitude: AppState.altitude.base || 0,
        currentElevation: AppState.altitude.current || 0
    };

    // Logic Rule: Dew Point cannot be > Temp
    if (!isNaN(state.temp) && !isNaN(state.dew) && state.dew > state.temp) {
        state.dew = state.temp;
        els.dew.value = formatDisplayTemperature(state.temp, 1, system); // Update UI immediately
    }

    // 2. Pure Calculation (Engine)
    const res = calculatePacingState(state, hapCalc);
    // 3. Render Results
    // a) Invalid Input Handling
    if (!res || !res.valid) {
        if (els.pred5k) els.pred5k.textContent = "--:--";
        if (els.vdot) els.vdot.textContent = "--";
        const elThreshold = document.getElementById('vdot-threshold');
        if (elThreshold) {
            elThreshold.textContent = `--/${paceUnit(system)}`;
            setThresholdRangeTooltipState(elThreshold, null, system);
        }
        return;
    }
    // b) Valid Output Rendering
    if (document.activeElement !== els.inputPace && els.inputPace) {
        els.inputPace.value = formatTime(res.inputPaceSec);
    }
    if (els.pred5k) els.pred5k.textContent = formatTime(res.pred5kSec);
    if (els.vdot) {
        // Animate VDOT
        const current = parseFloat(els.vdot.textContent) || 0;
        animateValue('vdot-val', current, res.vdot, 800);
    }
    // Keep this exactly aligned with cv-threshold-calculator defaults (AGE_DEFAULT = 25).
    const trainingPaces = estimateCvTrainingPaces(state.distance, state.timeSec, 25);
    const elThreshold = document.getElementById('vdot-threshold');
    if (elThreshold) {
        elThreshold.textContent = formatPace(res.paces.threshold, formatTime, system);
        bindThresholdRangeTooltip(elThreshold);
        setThresholdRangeTooltipState(elThreshold, trainingPaces, system);
    }

    // Update VDOT Gauge with Age Grade
    const age = AppState.runner.age;
    const gender = AppState.runner.gender;
    let ageGradeScore = null;
    if (age && gender) {
        const agRes = calculateAgeGrade(state.distance, state.timeSec, age, gender);
        if (agRes) ageGradeScore = agRes.score;
    }
    updateVDOTGauge(res.vdot, ageGradeScore);

    // Live Update of VDOT Details if Open
    const vdotDetails = document.getElementById('vdot-details');
    if (vdotDetails && vdotDetails.style.display !== 'none') {
        renderVDOTDetails();
    }
    // Determine Impact Color
    let impactColor = "#fb923c"; // fallback
    if (res.weather.valid) {
        impactColor = getImpactColor(res.weather.impactPct, state.temp);
    }
    const view = AppState.paceView || { heat: false, headwind: false, tailwind: false, altitude: false };

    // Helper: Render Pace Row
    const renderRow = (key, elPace, elDist, distDuration) => {
        if (!elPace) return;

        const pace = res.paces[key];

        // Build the content columns
        let cols = [];

        // 1. Base Pace (Always Shown)
        cols.push({
            id: "base",
            label: "Base",
            paceSec: pace,
            color: "#e6edf3", // default text color
            isBase: true
        });

        // 2. Heat Adjusted (if valid AND toggled)
        if (view.heat && res.weather.valid && res.weather.adjustedPaces[key]) {
            const adj = res.weather.adjustedPaces[key];
            // Show only if meaningful difference (> 0.5s)
            if (adj > 0 && Math.abs(adj - pace) > 0.5) {
                cols.push({
                    id: "heat",
                    label: "Heat",
                    paceSec: adj,
                    color: impactColor
                });
            }
        }
        // 3. Wind Adjusted (Head/Tail)
        if (res.weather.windPaces && res.weather.windPaces[key]) {
            const wp = res.weather.windPaces[key];

            // Headwind
            if (view.headwind && wp.headwind && wp.headwind > 0) {
                cols.push({
                    id: "headwind",
                    label: "Headwind",
                    paceSec: wp.headwind,
                    color: "#f87171" // Soft Red (Tailwind Red-400)
                });
            }

            // Tailwind
            if (view.tailwind && wp.tailwind && wp.tailwind > 0) {
                cols.push({
                    id: "tailwind",
                    label: "Tailwind",
                    paceSec: wp.tailwind,
                    color: "#4ade80" // Soft Green (Tailwind Green-400)
                });
            }
        }

        // 4. Altitude Adjusted (if valid AND toggled)
        if (view.altitude && res.altitude && res.altitude.valid && res.altitude.adjustedPaces[key]) {
            const altAdj = res.altitude.adjustedPaces[key];
            const isGain = altAdj < pace; // Faster pace = gain (descending)
            // Show only if meaningful difference (> 0.5s)
            if (altAdj > 0 && Math.abs(altAdj - pace) > 0.5) {
                cols.push({
                    id: "altitude",
                    label: isGain ? "Alt ↓" : "Alt ↑",
                    paceSec: altAdj,
                    color: isGain ? "#4ade80" : "#a78bfa" // Green for gain, Purple for penalty
                });
            }
        }
        const renderColsCanvas = (renderCols) => {
            const wrapClass = renderCols.length > 1
                ? 'pace-columns-wrap pace-columns-wrap--multi'
                : 'pace-columns-wrap pace-columns-wrap--single';
            const trackClass = `pace-columns-track cols-${Math.min(renderCols.length, 5)}`;
            let html = `<div class="${wrapClass}"><div class="${trackClass}" style="--pace-col-count:${renderCols.length};">`;

            renderCols.forEach((col, i) => {
                let innerHtml = "";
                const basePace = formatPace(col.paceSec, formatTime, system);
                const speedKmh = (Number.isFinite(col.paceSec) && col.paceSec > 0)
                    ? `${(3600 / col.paceSec).toFixed(1)}km/h`
                    : '--.-km/h';
                innerHtml += `<div class="pace-hover-value" data-pace-default="${escapeAttr(basePace)}" data-pace-kmh="${escapeAttr(speedKmh)}" style="font-weight:${col.isBase ? '600' : '500'}; color:${col.color}; white-space:nowrap;">
                                ${basePace}
                              </div>`;

                if (distDuration > 0) {
                    const dMeters = Math.round((distDuration / col.paceSec) * 1000);
                    innerHtml += `<div class="pace-distance-value" style="color:${col.color};">
                                     ${dMeters} m
                                   </div>`;
                }

                let labelHtml = "";
                if (!col.isBase) {
                    labelHtml = `<div class="pace-col-label">${col.label}</div>`;
                } else if (renderCols.length > 1) {
                    labelHtml = `<div class="pace-col-label pace-col-label--base">Base</div>`;
                }

                const colClass = i > 0 ? 'pace-column pace-column--with-separator' : 'pace-column';
                html += `<div class="${colClass}">
                            ${labelHtml}
                            ${innerHtml}
                         </div>`;
            });

            html += `</div></div>`;
            return html;
        };

        const isMobile = isMobilePaceFocusViewport();
        let htmlCanvas = '';
        if (isMobile && cols.length > 2) {
            const baseCol = cols[0];
            const adjustments = cols.slice(1);
            const byId = Object.create(null);
            adjustments.forEach((adj) => {
                if (adj && adj.id) byId[adj.id] = adj;
            });

            const usedIds = new Set();
            const slides = [];

            if (byId.heat) {
                slides.push([baseCol, byId.heat]);
                usedIds.add('heat');
            }

            const windSlide = [baseCol];
            if (byId.headwind) {
                windSlide.push(byId.headwind);
                usedIds.add('headwind');
            }
            if (byId.tailwind) {
                windSlide.push(byId.tailwind);
                usedIds.add('tailwind');
            }
            if (windSlide.length > 1) {
                slides.push(windSlide);
            }

            if (byId.altitude) {
                slides.push([baseCol, byId.altitude]);
                usedIds.add('altitude');
            }

            adjustments.forEach((adj) => {
                if (!adj || !adj.id || usedIds.has(adj.id)) return;
                slides.push([baseCol, adj]);
                usedIds.add(adj.id);
            });

            if (slides.length <= 1) {
                htmlCanvas = renderColsCanvas(slides[0] || cols);
            } else {
                htmlCanvas = `<div class="pace-carousel"><div class="pace-carousel-track">`;
                slides.forEach((slideCols) => {
                    htmlCanvas += `<div class="pace-carousel-slide">${renderColsCanvas(slideCols)}</div>`;
                });
                htmlCanvas += `</div>`;

                htmlCanvas += `<div class="pace-carousel-dots">`;
                slides.forEach((_, idx) => {
                    const activeClass = idx === 0 ? ' is-active' : '';
                    htmlCanvas += `<button type="button" class="pace-carousel-dot${activeClass}" data-slide-index="${idx}" aria-label="Pace slide ${idx + 1}"></button>`;
                });
                htmlCanvas += `</div></div>`;
            }
        } else {
            htmlCanvas = renderColsCanvas(cols);
        }
        // We replace elPace content with the canvas.
        elPace.innerHTML = htmlCanvas;
        bindPaceHoverInteractions(elPace);
        bindPaceCarousel(elPace);
        if (Number.isFinite(pace) && pace > 0) {
            elPace.dataset.basePaceSec = String(pace);
        } else {
            delete elPace.dataset.basePaceSec;
        }
        // Hide separate distance element logic
        if (elDist) {
            elDist.innerHTML = "";
            elDist.style.display = "none";
        }
    };

    // Render Cards
    renderRow('p10min', els.pace10, els.dist10, 600);
    renderRow('p6min', els.pace6, els.dist6, 360);
    renderRow('p3min', els.pace3, els.dist3, 180);
    renderRow('p1min', els.pace1, els.dist1, 60);
    renderRow('easy', els.paceEasy, null, 0);

    // Impact Text - Heat
    if (res.weather.valid) {
        if (els.weatherImpact) {
            const heatInfoIcon = infoIcon(
                '',
                'Pace adjustment from Hot-weather pace calculator by &lt;a href=&quot;https://apps.runningwritings.com/heat-adjusted-pace/&quot; target=&quot;_blank&quot;&gt;John Davis&lt;/a&gt;.',
                'info-tooltip-trigger--card-corner'
            );
            els.weatherImpact.innerHTML = `Heat Impact: <span class="impact-note-value" style="--impact-note-color:${impactColor}">~${res.weather.impactPct.toFixed(1)}% slowdown</span>${heatInfoIcon}`;
        }
    } else {
        if (els.weatherImpact) els.weatherImpact.textContent = "";
    }

    // Impact Text - Wind
    if (els.windImpact) {
        if (res.weather.windImpact) {
            const { headwindPct, tailwindPct } = res.weather.windImpact;
            // Format: "Headwind -X% | Tailwind +Y%"
            // Use specific colors: Red for Headwind, Green for Tailwind
            let html = "";

            // Headwind (Slowdown)
            if (Math.abs(headwindPct) > 0.1) {
                html += `<div class="impact-note-line impact-note-line--spaced">Headwind<br><span class="impact-note-value impact-note-value--headwind">~${headwindPct.toFixed(1)}% slowdown</span></div>`;
            }

            // Tailwind (Increase/Speedup)
            if (Math.abs(tailwindPct) > 0.1) {
                const val = Math.abs(tailwindPct);
                html += `<div class="impact-note-line">Tailwind<br><span class="impact-note-value impact-note-value--tailwind">~${val.toFixed(1)}% faster</span></div>`;
            }
            if (!html) html = "Wind Impact: Negligible";
            const windInfoIcon = infoIcon(
                '',
                'Pace adjustment from Headwind and tailwind calculator by &lt;a href=&quot;https://apps.runningwritings.com/wind-calculator&quot; target=&quot;_blank&quot;&gt;John Davis&lt;/a&gt;.',
                'info-tooltip-trigger--card-corner'
            );

            els.windImpact.innerHTML = html + windInfoIcon;
        } else {
            els.windImpact.textContent = "";
        }
    }
    // Save State (Side Effect)
    saveToStorage('vdot_calc_state', {
        distance: state.distance,
        time: els.time.value // keep raw string
    });
}

export function copyResults(els) {
    if (!els || !els.time) return; // safety
    const system = getUnitSystem();
    const inputTime = els.time.value;
    const inputDist = els.distance.value;
    const currentVDOT = els.vdot.textContent;

    const getTxt = (el) => el && el.innerText ? el.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const results = [
        `NSA Pacing (TT: ${inputDist}m in ${inputTime})`,
        `VDOT: ${currentVDOT}`,
        ``,
        `Sub-T Workouts:`,
        `- 10min (30KP): ${getTxt(els.pace10)}`,
        `- 6min (HMP): ${getTxt(els.pace6)}`,
        `- 3min (15KP): ${getTxt(els.pace3)}`,
        ``,
        `Easy Pace: ${getTxt(els.paceEasy)}`
    ];

    if (els.temp.value) {
        results.splice(2, 0, `Weather: ${els.temp.value}${temperatureUnit(system)} (Dew: ${els.dew.value || '-'}${temperatureUnit(system)})`);
    }
    navigator.clipboard.writeText(results.join('\n')).then(() => {
        showToast("Results copied!");
    }).catch(err => console.error("Failed to copy", err));
}
export function useGPS() {
    if (!navigator.geolocation) {
        fetchIPLocation({ message: "Geolocation not supported" });
        return;
    }
    setInlineGpsButtonLoading(true, 'Locating...');

    const options = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
    };
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const request = beginRequest(RequestKeys.REVERSE_GEOCODE, {
            abortPrevious: true,
            meta: { lat, lon }
        });
        try {
            const city = await reverseGeocode(lat, lon, { signal: request.signal });
            if (!isRequestCurrent(RequestKeys.REVERSE_GEOCODE, request.seq)) return;
            const name = city ? city.name : "My Location";
            const country = city ? city.country : "";
            const region = city ? city.region : '';
            stageLocationSelection(
                {
                    lat,
                    lon,
                    name,
                    country,
                    region,
                    elevation: null
                },
                { clearActiveItem: true, recenterMap: true }
            );
            setLocationMapStatus('GPS suggestion ready. Click Confirm location.', 'ready');
            endRequest(RequestKeys.REVERSE_GEOCODE, request.seq, 'success');
        } catch (e) {
            if (e && e.name === 'AbortError') {
                endRequest(RequestKeys.REVERSE_GEOCODE, request.seq, 'aborted');
                setInlineGpsButtonLoading(false);
                return;
            }
            endRequest(
                RequestKeys.REVERSE_GEOCODE,
                request.seq,
                'error',
                e && e.message ? e.message : 'Reverse geocode failed'
            );
            console.error("GPS Reverse Geocode Error", e);
            stageLocationSelection(
                {
                    lat,
                    lon,
                    name: "My Location",
                    country: "",
                    region: "",
                    elevation: null
                },
                { clearActiveItem: true, recenterMap: true }
            );
            setLocationMapStatus('GPS position ready. Click Confirm location.', 'ready');
        }
        setInlineGpsButtonLoading(false);
    }, (err) => {
        console.warn("Native GPS Error:", err);
        // Fallback to IP location if GPS fails (e.g., kCLErrorLocationUnknown)
        fetchIPLocation(err);
    }, options);
}

// Block-level loading skeletons (non-blocking for whole app)
const loadTimers = {};
let skeletonVisualSeq = 0;

function getWeatherSkeletonSvgMarkup(seed) {
    const cloudId = `cloudGradDark-${seed}`;
    const sunId = `sunGradVibrant-${seed}`;
    return `
<svg class="weather-skeleton-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="80" height="80" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${cloudId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>
    <linearGradient id="${sunId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7B54" />
      <stop offset="100%" stop-color="#FFB26B" />
    </linearGradient>
    <style>
      .skel-sun-dark {
        transform-origin: center;
        animation: skelPulseAndSpinDark 3s linear infinite;
        fill: url(#${sunId});
      }
      .skel-cloud-dark {
        fill: url(#${cloudId});
        animation: skelFloatCloudDark 2.5s ease-in-out infinite;
      }
      .skel-shimmer-dark {
        animation: skelShimmerDark 1.5s infinite;
        opacity: 0.6;
      }
      @keyframes skelPulseAndSpinDark {
        0% { transform: scale(1) rotate(0deg); opacity: 0.7; }
        50% { transform: scale(1.15) rotate(180deg); opacity: 1; }
        100% { transform: scale(1) rotate(360deg); opacity: 0.7; }
      }
      @keyframes skelFloatCloudDark {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
      }
      @keyframes skelShimmerDark {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.8; }
      }
    </style>
  </defs>

  <g class="skel-shimmer-dark">
    <path class="skel-sun-dark" d="M50 20 A 15 15 0 1 1 49.9 20 Z" />
    <path class="skel-sun-dark" opacity="0.6" d="M50 0 L50 12 M50 88 L50 100 M0 50 L12 50 M88 50 L100 50 M14.6 14.6 L23.1 23.1 M76.9 76.9 L85.4 85.4 M14.6 85.4 L23.1 76.9 M76.9 14.6 L85.4 23.1" stroke="url(#${sunId})" stroke-width="4" stroke-linecap="round"/>
  </g>

  <path class="skel-cloud-dark" d="M 33 60 C 24 60 20 54 20 46 C 20 38 27 33 35 33 C 40 23 55 22 62 31 C 69 31 75 36 75 44 C 75 53 69 58 60 58 L 33 60 Z"/>
</svg>`;
}

function toggleBlockSkeletonVisual(el, visible) {
    if (!el) return;
    const existing = el.querySelector('.block-skeleton-visual');
    if (visible) {
        if (existing) return;
        const visual = document.createElement('div');
        visual.className = 'block-skeleton-visual';
        visual.setAttribute('aria-hidden', 'true');
        skeletonVisualSeq += 1;
        const seed = `${Date.now().toString(36)}-${skeletonVisualSeq}`;
        visual.innerHTML = getWeatherSkeletonSvgMarkup(seed);
        el.appendChild(visual);
        return;
    }
    if (existing) existing.remove();
}

const blockLoadingTargets = {
    current: [
        {
            resolve: () => document.getElementById('current-content'),
            classes: ['block-skeleton', 'block-skeleton-grid']
        }
    ],
    forecast: [
        {
            resolve: () => document.getElementById('forecast-grid-container-16')?.closest('.scroll-x-auto'),
            classes: ['block-skeleton', 'block-skeleton-heatmap']
        },
        {
            resolve: () => document.getElementById('forecast-chart-container-16')?.closest('.forecast-card'),
            classes: ['block-skeleton', 'block-skeleton-chart']
        },
        {
            resolve: () => document.getElementById('forecast-rain-chart-container-16')?.closest('.forecast-card'),
            classes: ['block-skeleton', 'block-skeleton-chart']
        },
        {
            resolve: () => document.getElementById('forecast-wind-chart-container-16')?.closest('.forecast-card'),
            classes: ['block-skeleton', 'block-skeleton-chart']
        },
        {
            resolve: () => document.getElementById('forecast-body-16')?.closest('.table-wrapper'),
            classes: ['block-skeleton', 'block-skeleton-table']
        }
    ],
    climate: [
        {
            // Dedicated shell keeps overlay stable while inner SVG is re-rendered.
            resolve: () => document.getElementById('climate-heatmap-shell'),
            classes: ['block-skeleton', 'block-skeleton-heatmap']
        },
        {
            resolve: () => document.getElementById('monthly-averages-content')?.closest('.forecast-card'),
            classes: ['block-skeleton', 'block-skeleton-list']
        },
        {
            resolve: () => document.querySelector('#tab-climate .section-row'),
            classes: ['block-skeleton', 'block-skeleton-strip']
        },
        {
            resolve: () => document.getElementById('climateTableBody')?.closest('.table-wrapper'),
            classes: ['block-skeleton', 'block-skeleton-table']
        }
    ]
};

function applyBlockLoading(type, visible) {
    const targets = blockLoadingTargets[type] || [];
    targets.forEach((target) => {
        const el = target.resolve();
        if (!el) return;
        target.classes.forEach((cls) => {
            if (visible) el.classList.add(cls);
            else el.classList.remove(cls);
        });
        const enableVisual = target.visual !== false;
        toggleBlockSkeletonVisual(el, visible && enableVisual);
    });
}

export function setLoading(type, visible) {
    if (visible) {
        if (loadTimers[type]) clearTimeout(loadTimers[type]);
        applyBlockLoading(type, true);
        return;
    }

    // Cancel pending show and clear immediately.
    if (loadTimers[type]) {
        clearTimeout(loadTimers[type]);
        loadTimers[type] = null;
    }
    applyBlockLoading(type, false);
}

// --- Infinite Scroll State ---

export function setupTableScrollListeners() {
    if (UIState.isScrollListenersSetup) return;

    // Forecast Table - use correct ID
    const foreBody = document.getElementById('forecast-body-16');
    const foreWrapper = foreBody?.closest('.table-wrapper');
    if (foreWrapper) {
        foreWrapper.addEventListener('scroll', () => {
            if (UIState.isBatchLoading) return;
            if (foreWrapper.scrollTop + foreWrapper.clientHeight >= foreWrapper.scrollHeight - 150) {
                AppStore.dispatch(StoreActions.patchUI({
                    isBatchLoading: true
                }));
                renderForecastTable('forecast-body-16', 14, true);
                setTimeout(() => {
                    AppStore.dispatch(StoreActions.patchUI({
                        isBatchLoading: false
                    }));
                }, 200);
            }
        });
    }
    // Climate Table
    const climBody = document.getElementById('climateTableBody');
    const climWrapper = climBody?.closest('.table-wrapper');
    if (climWrapper) {
        climWrapper.addEventListener('scroll', () => {
            if (UIState.isBatchLoading) return;
            if (climWrapper.scrollTop + climWrapper.clientHeight >= climWrapper.scrollHeight - 150) {
                AppStore.dispatch(StoreActions.patchUI({
                    isBatchLoading: true
                }));
                renderClimateTable(true);
                setTimeout(() => {
                    AppStore.dispatch(StoreActions.patchUI({
                        isBatchLoading: false
                    }));
                }, 200);
            }
        });
    }

    AppStore.dispatch(StoreActions.patchUI({
        isScrollListenersSetup: true
    }));
    console.log("Virtual Scroll Ready");

    // Init Effects
    initRipple();
}
