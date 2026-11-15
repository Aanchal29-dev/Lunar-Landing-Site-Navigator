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

import { toVisibilityLongitude, assertAnalysisResponse } from './contracts.js';
export { toVisibilityLongitude } from './contracts.js';

const API_TIMEOUT_MS = 300_000;

// A single request through the configured same-origin proxy. Never retry POSTs
// against the visitor's localhost or replace an API error with a second request.
export async function apiFetch(endpoint, options = {}, timeoutMs = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const signal = options.signal;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, timeoutMs);
    try {
        const response = await fetch(endpoint, {
            ...options,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...options.headers },
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const detail = payload?.detail;
            const message = typeof detail === 'string' ? detail : Array.isArray(detail)
                ? detail.map(item => `${(item.loc || []).join('.')}: ${item.msg || 'Invalid value'}`).join('; ')
                : `Backend request failed (HTTP ${response.status}). Check the API and proxy configuration.`;
            throw new Error(message);
        }
        if (!payload) throw new Error('The API returned no JSON. Check that the backend and /api proxy are running.');
        return payload;
    } catch (error) {
        if (error.name === 'AbortError' && !signal?.aborted) throw new Error('The backend request timed out. No result has been assumed; please retry.');
        if (error instanceof TypeError) throw new Error('Cannot reach the backend. Check the API service and frontend proxy.');
        throw error;
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
    }
}

function coordinate(value, name, minimum, maximum) {
    if (value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < minimum || Number(value) > maximum) throw new Error(`Invalid ${name}.`);
    return Number(value);
}
const latitude = value => coordinate(value, 'latitude (−90 to 90)', -90, 90);
const longitude = value => toVisibilityLongitude(coordinate(value, 'longitude (−180 to 360 east)', -180, 360));

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
export async function requestVisibilityAnalysis({ latitude_deg, longitude_deg, start_utc, duration_hours = 144 }, signal) {
    const payload = await apiFetch('/api/analyze', {
        method: 'POST',
        signal,
        body: JSON.stringify({
            latitude_deg: latitude(latitude_deg),
            longitude_deg: longitude(longitude_deg),
            start_utc,
            duration_hours: Number(duration_hours)
        })
    });

    assertAnalysisResponse(payload);
    if (Math.abs(payload.location.latitude_deg - latitude(latitude_deg)) > 1e-4 || Math.abs(payload.location.longitude_deg - longitude(longitude_deg)) > 1e-4 || Date.parse(payload.start_utc) !== Date.parse(start_utc) || payload.duration_hours !== Number(duration_hours)) throw new Error('The response does not match the requested mission.');
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
                latitude_deg: latitude(latitude_deg),
                longitude_deg: longitude(longitude_deg),
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
        latitude_deg: latitude(loc.latitude_deg),
        longitude_deg: longitude(loc.longitude_deg)
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
            latitude_deg: latitude(latitude_deg),
            longitude_deg: longitude(longitude_deg),
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
            latitude_deg: latitude(latitude_deg),
            longitude_deg: longitude(longitude_deg),
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
    if (!Array.isArray(payload)) throw new Error('The mission service returned an invalid catalogue.');
    return payload;
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


/** Source-backed ice reference sites; no terrain-safe route is implied. */
export async function requestWaterIce({ latitude_deg, longitude_deg }) {
    return apiFetch('/api/analyze-site', {
        method: 'POST',
        body: JSON.stringify({ lat: latitude(latitude_deg), lon: longitude(longitude_deg), search_radius_km: 250, path_segments: 16 }),
    }, 15000);
}
