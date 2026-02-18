import { AppState } from './appState.js';

const KG_TO_LB = 2.2046226218;
const CM_TO_IN = 0.3937007874;
const M_TO_FT = 3.280839895;
const KM_TO_MI = 0.6213711922;
const MM_TO_IN = 0.03937007874;

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function roundTo(value, decimals = 1) {
    const v = toNumber(value);
    if (v == null) return null;
    const p = 10 ** decimals;
    return Math.round(v * p) / p;
}

export function getUnitSystem() {
    return AppState.unitSystem === 'imperial' ? 'imperial' : 'metric';
}

export function isImperial(system = getUnitSystem()) {
    return system === 'imperial';
}

export function temperatureUnit(system = getUnitSystem()) {
    return isImperial(system) ? '°F' : '°C';
}

export function windUnit(system = getUnitSystem()) {
    return isImperial(system) ? 'mph' : 'km/h';
}

export function precipitationUnit(system = getUnitSystem()) {
    return isImperial(system) ? 'in' : 'mm';
}

export function elevationUnit(system = getUnitSystem()) {
    return isImperial(system) ? 'ft' : 'm';
}

export function weightUnit(system = getUnitSystem()) {
    return isImperial(system) ? 'lbs' : 'kg';
}

export function heightUnit(system = getUnitSystem()) {
    return isImperial(system) ? 'in' : 'cm';
}

export function paceUnit(system = getUnitSystem()) {
    return isImperial(system) ? 'mi' : 'km';
}

export function celsiusToFahrenheit(celsius) {
    const v = toNumber(celsius);
    if (v == null) return null;
    return (v * 9 / 5) + 32;
}

export function fahrenheitToCelsius(fahrenheit) {
    const v = toNumber(fahrenheit);
    if (v == null) return null;
    return (v - 32) * 5 / 9;
}

export function kmhToMph(kmh) {
    const v = toNumber(kmh);
    if (v == null) return null;
    return v * KM_TO_MI;
}

export function mphToKmh(mph) {
    const v = toNumber(mph);
    if (v == null) return null;
    return v / KM_TO_MI;
}

export function mmToInches(mm) {
    const v = toNumber(mm);
    if (v == null) return null;
    return v * MM_TO_IN;
}

export function inchesToMm(inches) {
    const v = toNumber(inches);
    if (v == null) return null;
    return v / MM_TO_IN;
}

export function metersToFeet(meters) {
    const v = toNumber(meters);
    if (v == null) return null;
    return v * M_TO_FT;
}

export function feetToMeters(feet) {
    const v = toNumber(feet);
    if (v == null) return null;
    return v / M_TO_FT;
}

export function kilogramsToPounds(kg) {
    const v = toNumber(kg);
    if (v == null) return null;
    return v * KG_TO_LB;
}

export function poundsToKilograms(lb) {
    const v = toNumber(lb);
    if (v == null) return null;
    return v / KG_TO_LB;
}

export function centimetersToInches(cm) {
    const v = toNumber(cm);
    if (v == null) return null;
    return v * CM_TO_IN;
}

export function inchesToCentimeters(inches) {
    const v = toNumber(inches);
    if (v == null) return null;
    return v / CM_TO_IN;
}

export function toDisplayTemperature(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? celsiusToFahrenheit(v) : v;
}

export function toMetricTemperature(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? fahrenheitToCelsius(v) : v;
}

export function toDisplayWind(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? kmhToMph(v) : v;
}

export function toMetricWind(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? mphToKmh(v) : v;
}

export function toDisplayPrecip(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? mmToInches(v) : v;
}

export function toMetricPrecip(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? inchesToMm(v) : v;
}

export function toDisplayElevation(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? metersToFeet(v) : v;
}

export function toMetricElevation(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? feetToMeters(v) : v;
}

export function toDisplayWeight(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? kilogramsToPounds(v) : v;
}

export function toMetricWeight(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? poundsToKilograms(v) : v;
}

export function toDisplayHeight(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? centimetersToInches(v) : v;
}

export function toMetricHeight(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? inchesToCentimeters(v) : v;
}

export function toDisplayPaceSeconds(value, system = getUnitSystem()) {
    const v = toNumber(value);
    if (v == null) return null;
    return isImperial(system) ? (v * (1 / KM_TO_MI)) : v;
}

export function formatDisplayNumber(value, decimals = 1) {
    const v = toNumber(value);
    if (v == null) return '--';
    return v.toFixed(decimals);
}

export function formatDisplayTemperature(value, decimals = 1, system = getUnitSystem()) {
    return formatDisplayNumber(toDisplayTemperature(value, system), decimals);
}

export function formatDisplayWind(value, decimals = 1, system = getUnitSystem()) {
    return formatDisplayNumber(toDisplayWind(value, system), decimals);
}

export function formatDisplayPrecip(value, decimalsMetric = 1, decimalsImperial = 2, system = getUnitSystem()) {
    const decimals = isImperial(system) ? decimalsImperial : decimalsMetric;
    return formatDisplayNumber(toDisplayPrecip(value, system), decimals);
}

export function formatDisplayElevation(value, system = getUnitSystem()) {
    const decimals = isImperial(system) ? 0 : 0;
    return formatDisplayNumber(toDisplayElevation(value, system), decimals);
}

export function formatDisplayWeight(value, system = getUnitSystem()) {
    const decimals = isImperial(system) ? 1 : 1;
    return formatDisplayNumber(toDisplayWeight(value, system), decimals);
}

export function formatDisplayHeight(value, system = getUnitSystem()) {
    const decimals = isImperial(system) ? 1 : 0;
    return formatDisplayNumber(toDisplayHeight(value, system), decimals);
}

export function formatPace(valueSecondsPerKm, formatTimeFn, system = getUnitSystem()) {
    const seconds = toDisplayPaceSeconds(valueSecondsPerKm, system);
    if (seconds == null) return `--:--/${paceUnit(system)}`;
    return `${formatTimeFn(seconds)}/${paceUnit(system)}`;
}

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

export function updateUnitLabels(system = getUnitSystem()) {
    setElementText('label-temp', `Temperature (${temperatureUnit(system)})`);
    setElementText('label-dew', `Dew Point (${temperatureUnit(system)})`);
    setElementText('label-wind', `Wind Speed (${windUnit(system)})`);
    setElementText('label-input-pace', `Pace (/${paceUnit(system)})`);
    setElementText('settings-weight-unit', weightUnit(system));
    setElementText('settings-height-unit', heightUnit(system));
    setElementText('settings-altitude-unit', elevationUnit(system));

    setElementText('legend-rain-label', `Rain (${precipitationUnit(system)})`);
    setElementText('legend-wind-label', `Wind (${windUnit(system)})`);

    const tempInput = document.getElementById('temp');
    if (tempInput) tempInput.title = `Temperature in ${isImperial(system) ? 'Fahrenheit' : 'Celsius'}`;
    const dewInput = document.getElementById('dew');
    if (dewInput) dewInput.title = `Dew Point in ${isImperial(system) ? 'Fahrenheit' : 'Celsius'}`;
    const windInput = document.getElementById('wind');
    if (windInput) windInput.title = `Wind Speed in ${windUnit(system)}`;
}

export function formatEditableValue(value, decimals = 1) {
    const v = roundTo(value, decimals);
    if (v == null) return '';
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(decimals);
}
