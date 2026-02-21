import { UIState } from './state.js';
import { infoIcon, getCondColor, getDewColor } from './utils.js';
import { calculateWBGT } from '../engine.js';
import { AppStore, StoreActions } from '../store.js';
import {
    elevationUnit,
    formatDisplayElevation,
    formatDisplayPrecip,
    formatDisplayTemperature,
    formatDisplayWind,
    getUnitSystem,
    precipitationUnit,
    temperatureUnit,
    windUnit
} from '../units.js';

export function renderCurrentTab(w, a, prob2h = 0, precip2h = 0, daily, elevation) {
    const container = document.getElementById('current-content');
    if (!container) return;
    const system = getUnitSystem();
    const tempUnitLabel = temperatureUnit(system);
    const windUnitLabel = windUnit(system);
    const precipUnitLabel = precipitationUnit(system);
    const elevationUnitLabel = elevationUnit(system);

    // Update Elevation Displays (Global, since buttons are outside this container)
    document.querySelectorAll('.elevation-display').forEach(el => {
        if (elevation !== undefined && elevation !== null) {
            el.textContent = `${formatDisplayElevation(elevation, system)}${elevationUnitLabel}`;
            el.style.display = 'block';
        } else {
            el.textContent = '';
            el.style.display = 'none';
        }
    });

    // Metrics
    const safeVal = (v, dec = 1) => (v != null && !isNaN(v)) ? v.toFixed(dec) : '--';
    const rh = w.relative_humidity_2m;
    const feels = w.apparent_temperature;
    const wind = w.wind_speed_10m;
    const windGust = w.wind_gusts_10m || 0;
    const dir = w.wind_direction_10m; // degrees
    const rain = w.rain; // mm
    const precip = w.precipitation || 0;
    const uv = w.uv_index;
    const aqi = a ? a.us_aqi : '--';
    const pm25 = a ? a.pm2_5 : '--';
    const cloud = w.cloud_cover != null ? w.cloud_cover : 0;

    // Cloud Color logic
    const getCloudColor = (c) => {
        if (c < 20) return '#60a5fa'; // Clear/Blue
        if (c < 60) return '#9ca3af'; // Partly Cloudy/Gray
        return '#6b7280'; // Overcast/Dark Gray
    };
    const getCloudText = (c) => {
        if (c < 20) return 'Clear';
        if (c < 60) return 'Partly Cld';
        return 'Overcast';
    };

    // Convert Dir to Cardinal
    const getCardinal = (angle) => {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return directions[Math.round(angle / 45) % 8];
    };
    const windDirStr = getCardinal(dir);

    // --- WBGT Calculation (ACSM / BOM Estimation) ---
    // Moved to engine.js


    const wbgtVal = (w.shortwave_radiation != null) ? calculateWBGT(w.temperature_2m, w.relative_humidity_2m, w.wind_speed_10m, w.shortwave_radiation) : null;

    // --- New Metrics Calc ---
    const pressure = w.pressure_msl || 1013;

    // Sweat Rate (Heuristic)
    const srBase = wbgtVal !== null ? wbgtVal : feels;
    let sweatRate = 1.0 + (srBase - 20) * 0.05;
    if (sweatRate < 0.4) sweatRate = 0.4;

    // WBGT Color & Risk
    const getWBGTColor = (val) => {
        if (val < 18) return '#4ade80'; // Green (Low)
        if (val < 21) return '#facc15'; // Yellow (Moderate)
        if (val < 25) return '#fb923c'; // Orange (High)
        if (val < 28) return '#f87171'; // Red (Very High)
        return '#c084fc'; // Purple (Extreme)
    };
    const getWBGTText = (val) => {
        if (val < 18) return 'Low Risk';
        if (val < 21) return 'Mod. Risk'; // Adjusted for runner sensitivity
        if (val < 25) return 'High Risk';
        if (val < 28) return 'Very High';
        if (val < 30) return 'Extreme';
        return 'CANCEL';
    };




    // Styles
    const outerGridStyle = "display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; justify-items:center;";
    const cardStyle = "background:var(--card-bg); padding:16px; border-radius:12px; border:1px solid var(--border-color); width:100%;";
    const headStyle = "font-size:0.9rem; font-weight:600; color:var(--text-primary); margin-bottom:12px; display:flex; align-items:center; gap:6px;";
    const gridStyle = "display:grid; grid-template-columns: 1fr 1fr; gap:12px; row-gap:16px; align-items: stretch;";
    const itemStyle = "display:flex; flex-direction:column; justify-content:space-between; height:100%;";
    const labelStyle = "font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px;";
    const valStyle = "font-size:1.1rem; font-weight:500; color:var(--text-primary); margin-top:auto;";

    // sectionStyle is now cardStyle conceptually, but keeping name for minimal changes
    const sectionStyle = "background:var(--card-bg); padding:16px; border-radius:12px; border:1px solid var(--border-color);";

    // Update global store for copy
    AppStore.dispatch(StoreActions.patchUI({
        currentWeatherData: w,
        dailyForecast: daily // Store daily data specifically for Heatmap Shading lookup
    }));

    // Header structure is now static in index.html
    let html = '';

    // Helper for info icon


    // 1. Temperature Section (WBGT Integrated)
    html += `<div class="anim-card" style="${sectionStyle}">
                        <div style="${headStyle}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke="var(--text-secondary)"/>
                                <path class="anim-temp-fill" d="M11.5 14.76V6.5" stroke="currentColor" stroke-width="2"/>
                                <circle cx="11.5" cy="17.5" r="2.5" fill="currentColor" stroke="none" />
                            </svg> Temperature
                        </div>
                        <div style="${gridStyle}">
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Air ${infoIcon('Air Temperature', 'The dry-bulb temperature. Does not account for humidity or wind.<br><br><span style=&quot;color:#60a5fa&quot;><b>< 10°C (Cold):</b></span> Cool for running.<br><span style=&quot;color:#4ade80&quot;><b>10-28°C (Ideal):</b></span> Optimal range.<br><span style=&quot;color:#fb923c&quot;><b>28-32°C (Hot):</b></span> Pace impact.<br><span style=&quot;color:#f87171&quot;><b>32-35°C (Very Hot):</b></span> High risk.<br><span style=&quot;color:#c084fc&quot;><b>> 35°C (Extreme):</b></span> Dangerous.')}</div>
                                <div style="${valStyle}; color:${getCondColor('air', w.temperature_2m)}">${formatDisplayTemperature(w.temperature_2m, 1, system)} <span style="font-size:0.8em">${tempUnitLabel}</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">WBGT ${infoIcon('WBGT (Wet Bulb Globe Temp)', 'The Gold Standard for heat safety. Accounts for Temp, Humidity, Wind AND Solar Radiation.<br><br><span style=&quot;color:#4ade80&quot;><b>< 18°C (Low Risk):</b></span> Safe. Hard efforts OK.<br><span style=&quot;color:#facc15&quot;><b>18-21°C (Moderate):</b></span> Caution. Hydrate more.<br><span style=&quot;color:#fb923c&quot;><b>21-25°C (High):</b></span> Slow down. Heat cramps risk.<br><span style=&quot;color:#f87171&quot;><b>25-28°C (Very High):</b></span> Dangerous. Limit intensity.<br><span style=&quot;color:#c084fc&quot;><b>> 28°C (Extreme):</b></span> Cancel hard runs. Survival mode.')}</div>
                                <div style="${valStyle}; color:${wbgtVal !== null ? getWBGTColor(wbgtVal) : getCondColor('air', feels)}">
                                    ${wbgtVal !== null ? formatDisplayTemperature(wbgtVal, 1, system) : formatDisplayTemperature(feels, 1, system)} <span style="font-size:0.8em">${tempUnitLabel}</span>
                                </div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Dew Point ${infoIcon('Dew Point', 'The absolute measure of moisture in the air. The critical metric for runner comfort.<br><br><span style=&quot;color:#4ade80&quot;><b>< 15°C (Comfortable):</b></span> Crisp.<br><span style=&quot;color:#facc15&quot;><b>15-20°C (Humid):</b></span> Noticeable.<br><span style=&quot;color:#fb923c&quot;><b>20-24°C (Uncomfortable):</b></span> Hard.<br><span style=&quot;color:#f87171&quot;><b>> 24°C (Oppressive):</b></span> Very High Risk.')}</div>
                                <div style="${valStyle}; color:${getDewColor(w.dew_point_2m)}">${formatDisplayTemperature(w.dew_point_2m, 1, system)} <span style="font-size:0.8em">${tempUnitLabel}</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Humidity ${infoIcon('Relative Humidity', 'Relative saturation of the air. High humidity hinders sweat evaporation.<br><br><span style=&quot;color:#4ade80&quot;><b>< 75% (OK):</b></span> Good evaporation.<br><span style=&quot;color:#fb923c&quot;><b>75-90% (Sticky):</b></span> Sweat drips.<br><span style=&quot;color:#f87171&quot;><b>> 90% (Oppressive):</b></span> No evaporation.')}</div>
                                <div style="${valStyle}; color:${getCondColor('hum', rh)}">${safeVal(rh, 0)} <span style="font-size:0.8em">%</span></div>
                            </div>
                        </div>
                    </div>`;

    // 2. Wind & Precip
    // 2. Wind
    html += `<div class="anim-card" style="${sectionStyle}">
                        <div style="${headStyle}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle class="anim-wind-ring" cx="12" cy="12" r="9" stroke-dasharray="4 4" stroke-opacity="0.5"/>
                                <g class="anim-wind-needle">
                                    <polygon points="12 4 15 12 12 10 9 12" fill="currentColor" stroke="none"/>
                                    <polygon points="12 20 15 12 12 10 9 12" fill="rgba(255,255,255,0.2)" stroke="none"/>
                                </g>
                                <circle cx="12" cy="11.5" r="1.5" fill="var(--bg-color)" stroke="none"/>
                            </svg> Wind
                        </div>
                        <div style="${gridStyle}">
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Speed ${infoIcon('Wind Speed', 'Sustained wind speed at 10m height.<br><br><span style=&quot;color:#4ade80&quot;><b>< 10 km/h (Calm):</b></span> No impact.<br><span style=&quot;color:#facc15&quot;><b>10-20 km/h (Light):</b></span> Barely noticeable.<br><span style=&quot;color:#fb923c&quot;><b>20-30 km/h (Moderate):</b></span> Effort increases.<br><span style=&quot;color:#f87171&quot;><b>30-40 km/h (Strong):</b></span> Pace unreliable.<br><span style=&quot;color:#c084fc&quot;><b>> 40 km/h (Severe):</b></span> Running compromised.')}</div>
                                <div style="${valStyle}; color:${getCondColor('wind', wind)}">${formatDisplayWind(wind, 1, system)} <span style="font-size:0.7em">${windUnitLabel}</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Gusts ${infoIcon('Wind Gusts', 'Maximum instantaneous wind speed at 10 meters.<br><br><span style=&quot;color:#4ade80&quot;><b>< 20 km/h (Minimal):</b></span> Safe.<br><span style=&quot;color:#facc15&quot;><b>20-30 km/h (Noticeable):</b></span> Breezy.<br><span style=&quot;color:#fb923c&quot;><b>30-40 km/h (Strong):</b></span> Drag.<br><span style=&quot;color:#f87171&quot;><b>40-60 km/h (Very Strong):</b></span> Unsafe.<br><span style=&quot;color:#c084fc&quot;><b>> 60 km/h (Severe):</b></span> Dangerous.')}</div>
                                <div style="${valStyle}; color:${getCondColor('gust', windGust)}">${formatDisplayWind(windGust, 1, system)} <span style="font-size:0.7em">${windUnitLabel}</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Direction</div>
                                <div style="${valStyle}">${windDirStr} <span style="font-size:0.7em; color:var(--text-secondary);">(${dir}°)</span></div>
                            </div>
                        </div>
                    </div>`;

    html += `<div class="anim-card" style="${sectionStyle}">
                        <div style="${headStyle}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 1 9.9M15 13l-3-3m0 0l-3 3m3-3v12" stroke-opacity="0.3"/>
                                <line class="anim-rain-drop-1" x1="8" y1="12" x2="8" y2="12" stroke-width="3" />
                                <line class="anim-rain-drop-2" x1="12" y1="14" x2="12" y2="14" stroke-width="3" />
                                <line class="anim-rain-drop-3" x1="16" y1="12" x2="16" y2="12" stroke-width="3" />
                                <path d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 1 9.9" />
                            </svg> Precipitation
                        </div>
                        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; row-gap:16px; align-items: stretch;">
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Rain (2h) ${infoIcon('Rain Forecast', 'Estimated total precipitation currently expected for the next 2 hours.')}</div>
                                <div style="${valStyle}; color:${getCondColor('rain', precip2h)}">${formatDisplayPrecip(precip2h, 1, 2, system)} <span style="font-size:0.7em">${precipUnitLabel}</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Chance ${infoIcon('Rain Probability', 'Probability of precipitation.<br><br><span style=&quot;color:#4ade80&quot;><b>< 30% (Low):</b></span> Unlikely.<br><span style=&quot;color:#fb923c&quot;><b>30-60% (Medium):</b></span> Possible.<br><span style=&quot;color:#f87171&quot;><b>> 60% (High):</b></span> Look for shelter.')}</div>
                                <div style="${valStyle}; color:${getCondColor('prob', prob2h)}">${prob2h} <span style="font-size:0.7em">%</span></div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">Clouds ${infoIcon('Cloud Coverage', 'Percentage of sky covered by clouds.<br><br><span style=&quot;color:#60a5fa&quot;><b>0-20% (Clear):</b></span> Sunny.<br><span style=&quot;color:#9ca3af&quot;><b>20-60% (Partly):</b></span> Mixed.<br><span style=&quot;color:#6b7280&quot;><b>> 60% (Overcast):</b></span> Cloudy.')}</div>
                                <div style="${valStyle}; color:${getCloudColor(cloud)}">${cloud} <span style="font-size:0.7em">%</span></div>
                            </div>
                        </div>
                    </div>`;

    // 4. Radiation & Air
    // Remove local aqiColor logic in favor of getCondColor helper

    html += `<div class="anim-card" style="${sectionStyle}">
                        <div style="${headStyle}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle class="anim-rad-spin" cx="12" cy="12" r="10" stroke-dasharray="4 4 12 4" stroke-opacity="0.4"/>
                                <circle class="anim-rad-pulse" cx="12" cy="12" r="5" fill="currentColor"/>
                            </svg> Radiation & Air
                        </div>
                        <div style="${gridStyle} grid-template-columns: 1fr 1fr 1fr;">
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">UV Index ${infoIcon('UV Index (WHO)', 'Strength of sunburn-producing UV radiation.<br><br><span style=&quot;color:#4ade80&quot;><b>0-2 (Low):</b></span> Safe.<br><span style=&quot;color:#facc15&quot;><b>3-5 (Mod):</b></span> Sunscreen.<br><span style=&quot;color:#fb923c&quot;><b>6-7 (High):</b></span> Cover up.<br><span style=&quot;color:#f87171&quot;><b>8-10 (Very High):</b></span> Shade.<br><span style=&quot;color:#c084fc&quot;><b>11+ (Extreme):</b></span> Stay inside.')}</div>
                                <div style="${valStyle}; color:${getCondColor('uv', uv)}">${safeVal(uv, 2)}</div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">AQI ${infoIcon('US AQI (EPA)', 'Index for reporting daily air quality.<br><br><span style=&quot;color:#4ade80&quot;><b>0-50 (Good):</b></span> Breath easy.<br><span style=&quot;color:#facc15&quot;><b>51-100 (Mod):</b></span> Acceptable.<br><span style=&quot;color:#fb923c&quot;><b>101-150 (Sensitive):</b></span> Asthma risk.<br><span style=&quot;color:#f87171&quot;><b>151+ (Unhealthy):</b></span> Bad for all.')}</div>
                                <div style="${valStyle}; color:${getCondColor('aqi', aqi)}">${aqi}</div>
                            </div>
                            <div style="${itemStyle}">
                                <div style="${labelStyle}">PM2.5 ${infoIcon('PM2.5 (EPA)', 'Fine particles (<2.5µm) that penetrate lungs.<br><br><span style=&quot;color:#4ade80&quot;><b>0-12 (Good):</b></span> Clear.<br><span style=&quot;color:#fb923c&quot;><b>12-35 (Mod):</b></span> Haze.<br><span style=&quot;color:#f87171&quot;><b>35+ (Unhealthy):</b></span> Mask up.')}</div>
                                <div style="${valStyle}; color:${getCondColor('pm25', pm25)}">${pm25} <span style="font-size:0.7em">µg</span></div>
                            </div>
                        </div>
                    </div>`;



    // 5. Sun Cycle
    if (daily) {
        const fmtTime = (iso) => iso ? iso.substring(11, 16) : '--:--';

        // Helper: Add minutes to HH:MM string directly
        const shiftTime = (timeStr, deltaMin) => {
            if (!timeStr || timeStr === '--:--') return '--:--';
            const parts = timeStr.split(':');
            let h = parseInt(parts[0], 10);
            let m = parseInt(parts[1], 10);

            let total = h * 60 + m + deltaMin;
            if (total < 0) total += 1440; // wrap around day
            if (total >= 1440) total -= 1440;

            const newH = Math.floor(total / 60);
            const newM = total % 60;
            return String(newH).padStart(2, '0') + ':' + String(newM).padStart(2, '0');
        };

        // 5. Sun Cycle (Solar Horizon Graph)
        {
            // Parse times to minutes
            const toMin = (str) => {
                if (!str) return 0;
                const p = str.split(':').map(Number);
                return p[0] * 60 + p[1];
            };

            // Restore definitions
            const sunrise = fmtTime(daily.sunrise ? daily.sunrise[0] : null);
            const sunset = fmtTime(daily.sunset ? daily.sunset[0] : null);
            const dawn = shiftTime(sunrise, -25);
            const dusk = shiftTime(sunset, 25);

            const dawnMin = toMin(dawn);
            const sunriseMin = toMin(sunrise);
            const sunsetMin = toMin(sunset);
            const duskMin = toMin(dusk);

            // Current time in minutes
            const nowD = new Date();
            const nowMin = nowD.getHours() * 60 + nowD.getMinutes();

            // New Stats
            const totalDayMin = sunsetMin - sunriseMin;

            // Remaining daylight (sunset - now)
            const remainingMin = Math.max(0, sunsetMin - nowMin);
            const remHours = Math.floor(remainingMin / 60);
            const remM = remainingMin % 60;
            const daylightStr = remainingMin > 0 ? `${remHours}h ${remM}m left` : 'Night';

            const solarNoonMin = sunriseMin + (totalDayMin / 2);
            const noonH = Math.floor(solarNoonMin / 60);
            const noonM = Math.floor(solarNoonMin % 60);
            const solarNoonStr = `${String(noonH).padStart(2, '0')}:${String(noonM).padStart(2, '0')}`;

            // Graph Scales (ViewBox 300 x 60)
            const scaleX = (m) => (m / 1440) * 300;
            const yHorizon = 50;

            const xSunrise = scaleX(sunriseMin);
            const xSunset = scaleX(sunsetMin);
            const xNoon = scaleX(solarNoonMin);
            const xNow = scaleX(nowMin);

            html += `<div class="solar-card anim-card" style="${sectionStyle}">
                            <div style="${headStyle}">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path class="anim-solar-sun" d="M3 17 A9 9 0 0 1 21 17" stroke-dasharray="24" stroke-dashoffset="24" />
                                    <line x1="2" y1="17" x2="22" y2="17" stroke-opacity="0.3"/>
                                    <circle cx="12" cy="8" r="1" fill="currentColor"/>
                                </svg>
                                Solar Cycle
                                <span style="margin-left:auto; font-size:0.75em; font-weight:normal; color:var(--text-secondary);">${daylightStr}</span>
                            </div>
                            
                            <!-- Minimalist Arc Graph -->
                            <div style="position:relative; width:100%; height:50px; margin:8px 0;">
                                <svg viewBox="0 0 300 50" width="100%" height="100%" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="dayGradMin" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stop-color="#facc15" stop-opacity="0.2"/>
                                            <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
                                        </linearGradient>
                                    </defs>
                                    <!-- Horizon Line -->
                                    <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
                                    <!-- Sun Arc -->
                                    <path d="M ${xSunrise},40 Q ${xNoon},5 ${xSunset},40" fill="url(#dayGradMin)" stroke="rgba(250,204,21,0.4)" stroke-width="1" />
                                    <!-- Current Position - Discreet tick -->
                                    <line x1="${xNow}" y1="38" x2="${xNow}" y2="42" stroke="var(--accent-color)" stroke-width="1" opacity="${nowMin >= sunriseMin && nowMin <= sunsetMin ? 0.6 : 0.2}" />
                                </svg>
                            </div>
                            
                            <!-- Sunrise/Sunset Times -->
                            <div style="display:flex; justify-content:space-between; font-size:0.85em; color:var(--text-secondary);">
                                <div>
                                    <div style="color:var(--text-primary); font-weight:500;">${sunrise}</div>
                                    <div style="font-size:0.8em;">Dawn ${dawn}</div>
                                </div>
                                <div style="text-align:center;">
                                    <div style="font-size:0.7em; opacity:0.7;">NOON</div>
                                    <div style="color:var(--text-primary); font-weight:500;">${solarNoonStr}</div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="color:var(--text-primary); font-weight:500;">${sunset}</div>
                                    <div style="font-size:0.8em;">Dusk ${dusk}</div>
                                </div>
                            </div>
                        </div>`;
        }


    }

    // 6. Live Map Module (Windy)

    // Wrap all cards in 2-column grid with centered odd item
    const gridWrapper = `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">`;
    const gridEnd = `</div><style>.current-cards-grid > div:last-child:nth-child(odd) { grid-column: 1 / -1; max-width: 50%; justify-self: center; }</style>`;

    // Freshness Footer: Store timestamp and show relative time
    const dataTime = w.time; // ISO string from Open-Meteo (e.g., "2024-01-15T14:00")
    AppStore.dispatch(StoreActions.patchUI({
        currentDataTimestamp: dataTime ? new Date(dataTime) : new Date()
    }));

    const freshnessFooter = `<div id="data-freshness" style="text-align:center; padding:12px 0 4px; font-size:0.7rem; color:var(--text-secondary); opacity:0.6;"></div>`;

    container.innerHTML = gridWrapper + html + gridEnd + freshnessFooter;
    container.querySelector('div').classList.add('current-cards-grid');

    // Update the freshness text immediately and start interval
    updateFreshnessText();
    startFreshnessUpdater();
}

// --- Freshness Updater Logic ---
let freshnessIntervalId = null;

function updateFreshnessText() {
    const el = document.getElementById('data-freshness');
    if (!el || !UIState.currentDataTimestamp) return;

    const now = new Date();
    const diff = now - UIState.currentDataTimestamp;
    const mins = Math.floor(diff / 60000);

    let text;
    if (mins < 1) text = 'Updated just now';
    else if (mins === 1) text = 'Updated 1 min ago';
    else if (mins < 60) text = `Updated ${mins} min ago`;
    else {
        const hrs = Math.floor(mins / 60);
        text = hrs === 1 ? `Updated 1 hr ago` : `Updated ${hrs} hrs ago`;
    }
    el.textContent = text;
}

function startFreshnessUpdater() {
    // Clear previous interval to avoid duplicates
    if (freshnessIntervalId) clearInterval(freshnessIntervalId);
    // Update every 30 seconds
    freshnessIntervalId = setInterval(updateFreshnessText, 30000);
}
