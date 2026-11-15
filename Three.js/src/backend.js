const API_TIMEOUT_MS = 100_000;

export function toVisibilityLongitude(eastLongitudeDegrees) {
    const normalized = ((eastLongitudeDegrees % 360) + 360) % 360;
    return normalized > 180 ? normalized - 360 : normalized;
}

function readErrorDetail(payload, status) {
    if (payload && typeof payload.detail === 'string') return payload.detail;
    if (payload && Array.isArray(payload.detail)) return 'The mission request contains invalid values.';
    return `Visibility analysis failed (HTTP ${status}).`;
}

function assertAnalysisResponse(payload) {
    if (!payload || !payload.metrics || !Array.isArray(payload.timeline) || payload.timeline.length === 0) {
        throw new Error('The visibility service returned an incomplete analysis.');
    }
    for (const name of ['sunlight_percent', 'earth_visibility_percent', 'longest_darkness_hours', 'longest_earth_gap_hours']) {
        if (typeof payload.metrics[name] !== 'number' || !Number.isFinite(payload.metrics[name])) {
            throw new Error('The visibility service returned invalid metrics.');
        }
    }
    return payload;
}

export async function requestVisibilityAnalysis({ latitude_deg, east_longitude_deg, start_utc, duration_hours }) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                latitude_deg,
                longitude_deg: toVisibilityLongitude(east_longitude_deg),
                start_utc,
                duration_hours,
            }),
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(readErrorDetail(payload, response.status));
        return assertAnalysisResponse(payload);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error('NASA visibility analysis timed out. Please try again.');
        }
        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
}
