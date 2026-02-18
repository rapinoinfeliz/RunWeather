const TELEMETRY_STORAGE_KEY = 'rw_observability_events_v1';
const MAX_EVENTS = 120;

const telemetryState = {
    version: 'dev',
    sessionId: `rw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    startedAt: Date.now(),
    events: []
};

function safeNow() {
    return (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
}

function trimEvents() {
    if (telemetryState.events.length > MAX_EVENTS) {
        telemetryState.events.splice(0, telemetryState.events.length - MAX_EVENTS);
    }
}

function persistEvents() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify({
            sessionId: telemetryState.sessionId,
            version: telemetryState.version,
            startedAt: telemetryState.startedAt,
            events: telemetryState.events
        }));
    } catch (e) {
        // Best-effort only.
    }
}

function toAnalyticsPayload(payload) {
    const out = {};
    if (!payload || typeof payload !== 'object') return out;
    Object.entries(payload).forEach(([key, value]) => {
        if (value == null) return;
        const t = typeof value;
        if (t === 'string' || t === 'number' || t === 'boolean') {
            out[key] = value;
            return;
        }
        out[key] = JSON.stringify(value).slice(0, 180);
    });
    return out;
}

function normalizeError(input) {
    if (input instanceof Error) {
        return {
            name: input.name,
            message: input.message,
            stack: input.stack || null
        };
    }
    if (typeof input === 'string') {
        return { name: 'Error', message: input, stack: null };
    }
    return {
        name: 'Error',
        message: 'Unknown error',
        stack: null
    };
}

export function reportEvent(type, payload = {}, level = 'info') {
    const event = {
        ts: Date.now(),
        type,
        level,
        payload
    };
    telemetryState.events.push(event);
    trimEvents();
    persistEvents();

    const logger = (typeof console !== 'undefined' && typeof console[level] === 'function')
        ? console[level]
        : console.log;
    logger(`[RW:${type}]`, payload);

    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        try {
            window.gtag('event', type, {
                event_category: 'runweather',
                event_label: level,
                ...toAnalyticsPayload(payload)
            });
        } catch (e) {
            // Keep analytics strictly best-effort.
        }
    }
    return event;
}

export function reportError(error, context = {}) {
    const details = normalizeError(error);
    return reportEvent('error', {
        ...details,
        context
    }, 'error');
}

export async function measureAsync(name, fn, meta = {}) {
    const started = safeNow();
    try {
        const result = await fn();
        reportEvent('perf', {
            name,
            status: 'ok',
            durationMs: Number((safeNow() - started).toFixed(2)),
            meta
        });
        return result;
    } catch (error) {
        reportEvent('perf', {
            name,
            status: 'error',
            durationMs: Number((safeNow() - started).toFixed(2)),
            meta
        }, 'warn');
        throw error;
    }
}

export function initObservability(opts = {}) {
    if (typeof window === 'undefined') return;
    if (window.__rwObsInitialized) return;
    window.__rwObsInitialized = true;

    telemetryState.version = opts.version || telemetryState.version;

    window.addEventListener('error', (event) => {
        reportError(event.error || event.message || 'window.error', {
            source: event.filename || 'window',
            line: event.lineno || null,
            col: event.colno || null
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        reportError(event.reason || 'unhandledrejection', {
            source: 'promise'
        });
    });

    if (typeof PerformanceObserver !== 'undefined') {
        try {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.entryType === 'longtask' && entry.duration >= 120) {
                        reportEvent('longtask', {
                            durationMs: Number(entry.duration.toFixed(2)),
                            name: entry.name || 'longtask'
                        }, 'warn');
                    }
                });
            });
            observer.observe({ entryTypes: ['longtask'] });
        } catch (e) {
            // Long task observer is optional.
        }
    }

    reportEvent('session_start', {
        version: telemetryState.version,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    });
}

export function getTelemetrySnapshot() {
    return {
        version: telemetryState.version,
        sessionId: telemetryState.sessionId,
        startedAt: telemetryState.startedAt,
        events: telemetryState.events.slice()
    };
}
