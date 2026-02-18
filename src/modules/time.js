function pad2(n) {
    return String(n).padStart(2, '0');
}

export function getTimeZoneParts(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const map = {};
    fmt.formatToParts(new Date()).forEach(({ type, value }) => {
        if (type !== 'literal') map[type] = value;
    });

    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute)
    };
}

export function formatPartsToIsoMinute(parts) {
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function getNowIsoMinute(timeZone) {
    return formatPartsToIsoMinute(getTimeZoneParts(timeZone));
}

export function getNowIsoHour(timeZone) {
    return getNowIsoMinute(timeZone).slice(0, 13);
}

export function parseIsoMinuteToUtcDate(isoLike) {
    if (typeof isoLike !== 'string') return null;
    const match = isoLike.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::(\d{2}))?/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5] || 0);

    if ([year, month, day, hour, minute].some((v) => Number.isNaN(v))) return null;
    return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

export function formatUtcDateToIsoMinute(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

export function addDaysToIsoMinute(isoLike, days) {
    const base = parseIsoMinuteToUtcDate(isoLike);
    if (!base) return '';
    base.setUTCDate(base.getUTCDate() + Number(days || 0));
    return formatUtcDateToIsoMinute(base);
}

export function getISOWeekFromYmd(year, month, day) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function getNowIsoWeek(timeZone) {
    const p = getTimeZoneParts(timeZone);
    return getISOWeekFromYmd(p.year, p.month, p.day);
}

export function getReferenceYear(timeZone) {
    return getTimeZoneParts(timeZone).year;
}

export function getDateForISOWeek(week, year = getReferenceYear()) {
    const wk = Number(week);
    const yr = Number(year);
    if (!Number.isFinite(wk) || !Number.isFinite(yr) || wk < 1) {
        return new Date(Date.UTC(yr || 1970, 0, 1));
    }

    const jan4 = new Date(Date.UTC(yr, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

    const target = new Date(mondayWeek1);
    target.setUTCDate(mondayWeek1.getUTCDate() + ((wk - 1) * 7));
    return target;
}

export function formatDateDdMm(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--/--';
    return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}`;
}
