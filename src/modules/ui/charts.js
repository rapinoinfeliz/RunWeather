import { UIState } from './state.js';
import { getImpactColor, getBasePaceSec } from './utils.js';
import { formatTime } from '../core.js';

export function renderForecastChart(containerId, dayLimit) {
    const cont = document.getElementById(containerId || 'forecast-chart-container');
    if (!cont || !UIState.forecastData || UIState.forecastData.length === 0) return;

    // Data Slicing
    let chartData = UIState.forecastData;
    if (dayLimit) {
        chartData = UIState.forecastData.slice(0, 24 * dayLimit);
    }

    // Dimensions (Responsive)
    // Use clientWidth but wait for layout if possible?
    const w = cont.clientWidth;
    const h = 180; // Fixed height
    if (w === 0) return; // Not visible yet

    const pad = { top: 20, right: 10, bottom: 20, left: 45 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    // Scales
    const temps = chartData.map(d => d.temp);
    const dews = chartData.map(d => d.dew);
    const allVals = [...temps, ...dews];
    let minVal = Math.min(...allVals);
    let maxVal = Math.max(...allVals);
    minVal = Math.floor(minVal - 2);
    maxVal = Math.ceil(maxVal + 2);
    const valRange = maxVal - minVal;

    const getX = (i) => pad.left + (i / (chartData.length - 1)) * chartW;
    const getY = (val) => pad.top + chartH - ((val - minVal) / valRange) * chartH;

    // Paths
    // Paths (Handle Gaps for Null Data)
    let pathTemp = '';
    let pathDew = '';
    let hasStartedTemp = false;
    let hasStartedDew = false;

    chartData.forEach((d, i) => {
        const x = getX(i);

        // Temp Path
        if (d.temp != null) {
            const yT = getY(d.temp);
            const cmd = hasStartedTemp ? 'L' : 'M';
            pathTemp += `${cmd} ${x.toFixed(1)} ${yT.toFixed(1)} `;
            hasStartedTemp = true;
        } else {
            hasStartedTemp = false; // Break the line
        }

        // Dew Path
        if (d.dew != null) {
            const yD = getY(d.dew);
            const cmd = hasStartedDew ? 'L' : 'M';
            pathDew += `${cmd} ${x.toFixed(1)} ${yD.toFixed(1)} `;
            hasStartedDew = true;
        } else {
            hasStartedDew = false; // Break the line
        }
    });

    // Build SVG
    let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" class="chart-svg">`;

    // Grid & Labels
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        const val = minVal + (valRange * (i / steps));
        const y = getY(val);
        svg += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4 4" opacity="0.3" class="chart-grid-line" />`;
        svg += `<text x="${pad.left - 5}" y="${y + 3}" fill="var(--text-secondary)" font-size="9" text-anchor="end" class="chart-axis-label">${Math.round(val)}<tspan font-size="7" dx="1">°C</tspan></text>`;
    }

    // Days Delimiter (Midnight) & Labels (Noon)
    chartData.forEach((d, i) => {
        const date = new Date(d.time);
        const hour = parseInt(d.time.substring(11, 13)); // Robust parsing
        const x = getX(i);

        // Midnight Line
        if (hour === 0 && i > 0) {
            svg += `<line x1="${x}" y1="${pad.top}" x2="${x}" y2="${h - pad.bottom}" stroke="var(--border-color)" stroke-width="1" opacity="0.3" />`;
        }

        // Noon Label (Centered)
        if (hour === 12) {
            svg += `<text x="${x}" y="${h - 5}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${date.toLocaleDateString('en-US', { weekday: 'short' })}</text>`;
        }
    });

    // Selected Hour Highlight
    let selectedX = -1;
    if (UIState.selectedForeHour) {
        const idx = UIState.forecastData.findIndex(d => d.time === UIState.selectedForeHour);
        if (idx !== -1) {
            selectedX = getX(idx);
            svg += `<line x1="${selectedX}" y1="${pad.top}" x2="${selectedX}" y2="${h - pad.bottom}" stroke="var(--accent-color)" stroke-width="2" opacity="0.8" />`;
            // Highlight Dots
            const d = UIState.forecastData[idx];
            svg += `<circle cx="${selectedX}" cy="${getY(d.temp)}" r="4" fill="#f87171" stroke="white" stroke-width="2"/>`;
            svg += `<circle cx="${selectedX}" cy="${getY(d.dew)}" r="4" fill="#60a5fa" stroke="white" stroke-width="2"/>`;
        }
    }

    // Paths
    // Definitions for Gradients
    svg += `<defs>
        <linearGradient id="chartGradTemp" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#f87171" />
            <stop offset="50%" stop-color="#fbbf24" />
            <stop offset="100%" stop-color="#f87171" />
        </linearGradient>
        <linearGradient id="chartGradDew" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
        <linearGradient id="chartFillTemp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f87171" stop-opacity="0.2" />
            <stop offset="100%" stop-color="#f87171" stop-opacity="0" />
        </linearGradient>
    </defs>`;

    // Fill Area (Optional, implies closing path properly which is hard with simple line logic without calculating bottom points)
    // For now, simpler: Gradient Stroke.

    svg += `<path d="${pathDew}" fill="none" stroke="url(#chartGradDew)" stroke-width="2" stroke-linecap="round" />`;
    svg += `<path d="${pathTemp}" fill="none" stroke="url(#chartGradTemp)" stroke-width="2" stroke-linecap="round" />`;



    // Interaction Layer (Transparent)
    // We attach mouse events to the parent div or this rect
    // Easier to use inline events on rect for quick implementation
    svg += `<rect x="${pad.left}" y="${pad.top}" width="${chartW}" height="${chartH}" fill="white" fill-opacity="0" 
                            data-action="chart-interact"
                            data-total-w="${w}"
                            data-chart-w="${chartW}"
                            data-pad-left="${pad.left}"
                            data-len="${chartData.length}" />`;

    svg += `</svg>`;
    cont.innerHTML = svg;
}

export function renderRainChart(containerId, dayLimit) {
    const cont = document.getElementById(containerId || 'forecast-rain-chart-container-16');
    if (!cont || !UIState.forecastData || UIState.forecastData.length === 0) return;

    // Data Slicing
    let chartData = UIState.forecastData;
    if (dayLimit) {
        chartData = UIState.forecastData.slice(0, 24 * dayLimit);
    }

    const w = cont.clientWidth;
    const h = 180;
    if (w === 0) return;

    const pad = { top: 20, right: 30, bottom: 20, left: 30 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    // Scales
    const rains = chartData.map(d => d.rain || 0);
    const probs = chartData.map(d => d.prob || 0);

    // Y1 (Rain) Scale 0 to Max (min 5mm)
    let maxRain = Math.max(...rains, 5);
    maxRain = Math.ceil(maxRain);

    // Y2 (Prob) Scale 0 to 100
    const maxProb = 100;

    const getX = (i) => pad.left + (i / (chartData.length - 1)) * chartW;
    const getYRain = (val) => pad.top + chartH - (val / maxRain) * chartH;
    const getYProb = (val) => pad.top + chartH - (val / maxProb) * chartH;

    // Paths
    let pathProb = '';
    let hasStartedProb = false;

    // Build Bars (rects) and Line Path
    let barsHtml = '';

    const barW = Math.max(1, (chartW / chartData.length) - 1);

    chartData.forEach((d, i) => {
        const x = getX(i);

        // Rain Bar
        if (d.rain > 0) {
            const yR = getYRain(d.rain);
            const hR = (pad.top + chartH) - yR;
            // Center bar on point
            barsHtml += `<rect x="${x - barW / 2}" y="${yR}" width="${barW}" height="${hR}" fill="#60a5fa" opacity="0.8" />`;
        }

        // Prob Line
        if (d.prob != null) {
            const yP = getYProb(d.prob);
            const cmd = hasStartedProb ? 'L' : 'M';
            pathProb += `${cmd} ${x.toFixed(1)} ${yP.toFixed(1)} `;
            hasStartedProb = true;
        } else {
            hasStartedProb = false;
        }
    });

    let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" class="chart-svg">`;

    // Grid (Left Axis based - Rain)
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        const pct = i / steps;
        const y = pad.top + chartH - (pct * chartH);
        const valRain = pct * maxRain;
        const valProb = pct * maxProb;

        // Grid Line
        svg += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4 4" opacity="0.3" class="chart-grid-line" />`;

        // Label Left (Rain)
        svg += `<text x="${pad.left - 5}" y="${y + 3}" fill="#60a5fa" font-size="9" text-anchor="end" class="chart-axis-label">${Math.round(valRain)} <tspan font-size="7">mm</tspan></text>`;

        // Label Right (Prob)
        svg += `<text x="${w - pad.right + 5}" y="${y + 3}" fill="#93c5fd" font-size="9" text-anchor="start" class="chart-axis-label">${Math.round(valProb)}%</text>`;
    }

    // Days Delimiter (Midnight) & Labels (Noon)
    chartData.forEach((d, i) => {
        const date = new Date(d.time);
        const hour = parseInt(d.time.substring(11, 13));
        const x = getX(i);

        // Midnight Line
        if (hour === 0 && i > 0) {
            svg += `<line x1="${x}" y1="${pad.top}" x2="${x}" y2="${h - pad.bottom}" stroke="var(--border-color)" stroke-width="1" opacity="0.3" />`;
        }

        // Noon Label
        if (hour === 12) {
            svg += `<text x="${x}" y="${h - 5}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${date.toLocaleDateString('en-US', { weekday: 'short' })}</text>`;
        }
    });

    // Selected Hour Highlight
    let selectedX = -1;
    if (UIState.selectedForeHour) {
        const idx = UIState.forecastData.findIndex(d => d.time === UIState.selectedForeHour);
        if (idx !== -1) {
            selectedX = getX(idx);
            // Highlight Line
            svg += `<line x1="${selectedX}" y1="${pad.top}" x2="${selectedX}" y2="${h - pad.bottom}" stroke="var(--accent-color)" stroke-width="2" opacity="0.8" />`;
            // Highlight Dot for Prob
            const d = UIState.forecastData[idx];
            svg += `<circle cx="${selectedX}" cy="${getYProb(d.prob || 0)}" r="4" fill="#93c5fd" stroke="white" stroke-width="2"/>`;
        }
    }

    // Render Bars
    svg += barsHtml;

    // Render Prob Line
    svg += `<path d="${pathProb}" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" />`;

    // Interaction Layer
    // NOTE: 'chart-interact' relies on handleChartClick in UI events.
    // The key for selection toggling (allow re-select to toggle off) is handled in 'toggleForeSelection'.
    // If handleChartClick works for other charts, it should work here. 
    // Is it possible CSS pointer-events or stacking is an issue?
    // Let's ensure this rect is ON TOP and has pointer events.
    svg += `<rect x="${pad.left}" y="${pad.top}" width="${chartW}" height="${chartH}" fill="white" fill-opacity="0" 
                            class="chart-interact-layer"
                            data-action="chart-interact"
                            data-type="rain"
                            data-total-w="${w}"
                            data-chart-w="${chartW}"
                            data-pad-left="${pad.left}"
                            data-len="${chartData.length}" />`;

    svg += `</svg>`;
    cont.innerHTML = svg;
}

export function renderWindChart(containerId, dayLimit) {
    const cont = document.getElementById(containerId || 'forecast-wind-chart-container-16');
    if (!cont || !UIState.forecastData || UIState.forecastData.length === 0) return;

    // Data Slicing
    let chartData = UIState.forecastData;
    if (dayLimit) {
        chartData = UIState.forecastData.slice(0, 24 * dayLimit);
    }

    const w = cont.clientWidth;
    const h = 180;
    if (w === 0) return;

    const pad = { top: 20, right: 30, bottom: 20, left: 50 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    // Scales
    const winds = chartData.map(d => d.wind || 0);

    // Y Scale 0 to Max (min 20km/h for visual reasons)
    let maxWind = Math.max(...winds, 20);
    maxWind = Math.ceil(maxWind);

    const getX = (i) => pad.left + (i / (chartData.length - 1)) * chartW;
    const getY = (val) => pad.top + chartH - (val / maxWind) * chartH;

    // Paths
    let pathWind = '';
    let hasStarted = false;

    chartData.forEach((d, i) => {
        const x = getX(i);

        if (d.wind != null) {
            const y = getY(d.wind);
            const cmd = hasStarted ? 'L' : 'M';
            pathWind += `${cmd} ${x.toFixed(1)} ${y.toFixed(1)} `;
            hasStarted = true;
        } else {
            hasStarted = false;
        }
    });

    let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" class="chart-svg">`;

    // Grid (Left Axis based - Wind)
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        const pct = i / steps;
        const y = pad.top + chartH - (pct * chartH);
        const val = pct * maxWind;

        // Grid Line
        svg += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4 4" opacity="0.3" class="chart-grid-line" />`;

        // Label Left (Wind)
        svg += `<text x="${pad.left - 5}" y="${y + 3}" fill="#c084fc" font-size="9" text-anchor="end" class="chart-axis-label">${Math.round(val)} <tspan font-size="7">km/h</tspan></text>`;
    }

    // Days Delimiter (Midnight) & Labels (Noon)
    chartData.forEach((d, i) => {
        const date = new Date(d.time);
        const hour = parseInt(d.time.substring(11, 13));
        const x = getX(i);

        // Midnight Line
        if (hour === 0 && i > 0) {
            svg += `<line x1="${x}" y1="${pad.top}" x2="${x}" y2="${h - pad.bottom}" stroke="var(--border-color)" stroke-width="1" opacity="0.3" />`;
        }

        // Noon Label
        if (hour === 12) {
            svg += `<text x="${x}" y="${h - 5}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${date.toLocaleDateString('en-US', { weekday: 'short' })}</text>`;
        }
    });

    // Selected Hour Highlight
    let selectedX = -1;
    if (UIState.selectedForeHour) {
        const idx = UIState.forecastData.findIndex(d => d.time === UIState.selectedForeHour);
        if (idx !== -1) {
            selectedX = getX(idx);
            // Highlight Line
            svg += `<line x1="${selectedX}" y1="${pad.top}" x2="${selectedX}" y2="${h - pad.bottom}" stroke="var(--accent-color)" stroke-width="2" opacity="0.8" />`;
            // Highlight Dot for Wind
            const d = UIState.forecastData[idx];
            svg += `<circle cx="${selectedX}" cy="${getY(d.wind || 0)}" r="4" fill="#c084fc" stroke="white" stroke-width="2"/>`;
        }
    }

    // Render Line
    svg += `<path d="${pathWind}" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" />`;

    // Interaction Layer
    svg += `<rect x="${pad.left}" y="${pad.top}" width="${chartW}" height="${chartH}" fill="white" fill-opacity="0" 
                            class="chart-interact-layer"
                            data-action="chart-interact"
                            data-type="wind"
                            data-total-w="${w}"
                            data-chart-w="${chartW}"
                            data-pad-left="${pad.left}"
                            data-len="${chartData.length}" />`;

    svg += `</svg>`;
    cont.innerHTML = svg;
}

function getNightShadingSVG(daily, chartW, chartH, pad, chartData) {
    let shading = '';
    if (daily && daily.time) {
        const dTimes = daily.time;
        const sunrises = daily.sunrise;
        const sunsets = daily.sunset;

        // Iterate days in daily forecast
        for (let i = 0; i < dTimes.length; i++) {
            // Logic: Night is from Sunset(i) -> Sunrise(i+1)
            const sunset = new Date(sunsets[i]).getTime();
            let nextSunrise = null;
            if (i < dTimes.length - 1) {
                nextSunrise = new Date(sunrises[i + 1]).getTime();
            } else {
                continue; // Skip end of range
            }

            const dataStart = new Date(chartData[0].time).getTime();
            const dataEnd = new Date(chartData[chartData.length - 1].time).getTime();
            const totalMs = dataEnd - dataStart;

            // Check overlap
            if (nextSunrise < dataStart || sunset > dataEnd) continue;

            // Clamp
            const startMs = Math.max(sunset, dataStart);
            const endMs = Math.min(nextSunrise, dataEnd);

            if (startMs >= endMs) continue;

            const startPct = (startMs - dataStart) / totalMs;
            const endPct = (endMs - dataStart) / totalMs;

            const x1 = pad.left + (startPct * chartW);
            const x2 = pad.left + (endPct * chartW);
            const width = x2 - x1;

            if (width > 0) {
                shading += `<rect x="${x1}" y="${pad.top}" width="${width}" height="${chartH}" fill="rgba(0,0,0,0.2)" />`;
            }
        }

        // Special Case: Pre-dawn on First Day (Start of Chart -> Sunrise(0))
        if (chartData.length > 0 && sunrises.length > 0) {
            const firstSunrise = new Date(sunrises[0]).getTime();
            const dataStart = new Date(chartData[0].time).getTime();

            if (dataStart < firstSunrise) {
                const dataEnd = new Date(chartData[chartData.length - 1].time).getTime();
                const totalMs = dataEnd - dataStart;
                const endMs = Math.min(firstSunrise, dataEnd);

                if (endMs > dataStart) {
                    const width = ((endMs - dataStart) / totalMs) * chartW;
                    shading += `<rect x="${pad.left}" y="${pad.top}" width="${width}" height="${chartH}" fill="rgba(0,0,0,0.2)" />`;
                }
            }
        }
    }
    return shading;
}
