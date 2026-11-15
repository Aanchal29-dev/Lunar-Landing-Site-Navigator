/**
 * Lunar Compass - Backend API Client
 * Provides typed, fault-tolerant access to all FastAPI backend endpoints:
 * - /api/analyze (Sun & Earth Horizons Ephemeris)
 * - /api/terrain/analyze (LOLA Elevation & Slope Screening)
 * - /api/compare (Multi-Site Comparative Study)
 * - /api/stress-test (Mission Launch Delay Scenarios)
 * - /api/mission-windows (Candidate Window Illumination Optimizer)
 * - /api/missions (Historical Missions Catalog)
 * - /api/missions/{id} (Historical Mission Narrative & Details)
 * - /api/missions/{id}/replay (Modeled Environmental Replay)
 * - /health & /health/ready (Backend Health Checks)
 */

const API_TIMEOUT_MS = 60_000;

export function toVisibilityLongitude(eastLongitudeDegrees) {
    const normalized = ((eastLongitudeDegrees % 360) + 360) % 360;
    return normalized > 180 ? normalized - 360 : normalized;
}

function readErrorDetail(payload, status) {
    if (payload && typeof payload.detail === 'string') return payload.detail;
    if (payload && Array.isArray(payload.detail)) {
        return payload.detail.map(d => d.msg || JSON.stringify(d)).join('; ');
    }
    return `Service request failed (HTTP ${status}).`;
}

const DIRECT_BACKEND_URL = 'http://127.0.0.1:8000';

async function apiFetch(endpoint, options = {}, timeoutMs = API_TIMEOUT_MS) {
    // 1. Try relative URL (works through Vite proxy or same-origin)
    let primaryError = null;
    try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(endpoint, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(options.headers || {})
                },
                signal: controller.signal
            });

            if (response.ok) {
                const payload = await response.json().catch(() => null);
                return payload;
            }

            // If 404 on relative path, the frontend dev server may not have the /api proxy configured
            if (response.status === 404 && !endpoint.startsWith('http')) {
                primaryError = new Error(`404 from ${endpoint}`);
            } else {
                const payload = await response.json().catch(() => null);
                throw new Error(readErrorDetail(payload, response.status));
            }
        } finally {
            window.clearTimeout(timeoutId);
        }
    } catch (err) {
        primaryError = err;
    }

    // 2. Fallback to direct backend URL on port 8000 if relative URL gave 404 or connection failed
    if (primaryError && !endpoint.startsWith('http')) {
        const directUrl = `${DIRECT_BACKEND_URL}${endpoint}`;
        const fallbackController = new AbortController();
        const fallbackTimeoutId = window.setTimeout(() => fallbackController.abort(), timeoutMs);

        try {
            const response = await fetch(directUrl, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(options.headers || {})
                },
                signal: fallbackController.signal
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readErrorDetail(payload, response.status));
            }
            return payload;
        } catch (directErr) {
            if (directErr instanceof DOMException && directErr.name === 'AbortError') {
                throw new Error(`Request to ${endpoint} timed out. Please try again.`);
            }
            throw directErr;
        } finally {
            window.clearTimeout(fallbackTimeoutId);
        }
    }

    if (primaryError) throw primaryError;
}

/**
 * Check backend health and readiness
 */
export async function checkBackendHealth() {
    try {
        const health = await apiFetch('/health', { method: 'GET' }, 5000);
        return { ok: true, health };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/**
 * Request apparent-airless visibility analysis from JPL Horizons ephemeris
 */
export async function requestVisibilityAnalysis({ latitude_deg, longitude_deg, start_utc, duration_hours = 144 }) {
    const payload = await apiFetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
            latitude_deg: Number(latitude_deg),
            longitude_deg: toVisibilityLongitude(Number(longitude_deg)),
            start_utc,
            duration_hours: Number(duration_hours)
        })
    });

    if (!payload || !payload.metrics || !Array.isArray(payload.timeline)) {
        throw new Error('The visibility service returned an incomplete analysis.');
    }
    return payload;
}

/**
 * Request LOLA regional terrain screening (elevation, slope, roughness proxy)
 */
export async function requestTerrainAnalysis({ latitude_deg, longitude_deg, analysis_radius_m = 1000 }) {
    try {
        const payload = await apiFetch('/api/terrain/analyze', {
            method: 'POST',
            body: JSON.stringify({
                latitude_deg: Number(latitude_deg),
                longitude_deg: Number(longitude_deg),
                analysis_radius_m: Number(analysis_radius_m)
            })
        }, 15000);
        return payload;
    } catch (err) {
        return {
            terrain_available: false,
            warnings: [err.message]
        };
    }
}

/**
 * Request multi-site comparative study across a shared UTC window
 */
export async function requestComparison({ locations, start_utc, duration_hours = 144, include_terrain = false }) {
    const formattedLocations = locations.map(loc => ({
        label: loc.label || 'Candidate Site',
        latitude_deg: Number(loc.latitude_deg),
        longitude_deg: Number(loc.longitude_deg)
    }));

    const payload = await apiFetch('/api/compare', {
        method: 'POST',
        body: JSON.stringify({
            locations: formattedLocations,
            start_utc,
            duration_hours: Number(duration_hours),
            include_terrain: Boolean(include_terrain)
        })
    });
    return payload;
}

/**
 * Request mission stress test for launch slips (+1d, +3d, etc.)
 */
export async function requestStressTest({ latitude_deg, longitude_deg, baseline, variant }) {
    const payload = await apiFetch('/api/stress-test', {
        method: 'POST',
        body: JSON.stringify({
            latitude_deg: Number(latitude_deg),
            longitude_deg: Number(longitude_deg),
            baseline: {
                start_utc: baseline.start_utc,
                duration_hours: Number(baseline.duration_hours)
            },
            variant: {
                start_utc: variant.start_utc,
                duration_hours: Number(variant.duration_hours)
            }
        })
    });
    return payload;
}

/**
 * Request candidate mission window optimization
 */
export async function requestMissionWindows({
    latitude_deg,
    longitude_deg,
    target_start_utc,
    duration_hours = 144,
    candidate_offsets_days = [-3, -1, 1, 3, 7],
    priority = 'balanced'
}) {
    const payload = await apiFetch('/api/mission-windows', {
        method: 'POST',
        body: JSON.stringify({
            latitude_deg: Number(latitude_deg),
            longitude_deg: Number(longitude_deg),
            target_start_utc,
            duration_hours: Number(duration_hours),
            candidate_offsets_days,
            priority
        })
    });
    return payload;
}

/**
 * Fetch catalog of historical lunar missions
 */
export async function fetchHistoricalMissions() {
    const payload = await apiFetch('/api/missions', { method: 'GET' }, 10000);
    return Array.isArray(payload) ? payload : [];
}

/**
 * Fetch verified detailed narrative and sources for a single historical mission
 */
export async function fetchHistoricalMissionDetail(missionId) {
    const payload = await apiFetch(`/api/missions/${encodeURIComponent(missionId)}`, { method: 'GET' }, 10000);
    return payload;
}

/**
 * Replay modeled environmental conditions at historical landing site & time
 */
export async function requestHistoricalReplay(missionId, duration_hours = 144) {
    const payload = await apiFetch(`/api/missions/${encodeURIComponent(missionId)}/replay`, {
        method: 'POST',
        body: JSON.stringify({
            duration_hours: Number(duration_hours)
        })
    });
    return payload;
}
