// Simulated responses only for offline tests. Never imported by production code.
export function analysis({ latitude_deg = -85.2, longitude_deg = 32.5, start_utc = '2026-11-20T00:00:00Z', duration_hours = 144 } = {}) {
    const at = hours => new Date(Date.parse(start_utc) + hours * 3600000).toISOString().replace('.000Z', 'Z');
    return {
        location: { latitude_deg, longitude_deg }, start_utc, end_utc: at(duration_hours), duration_hours, sampling_minutes: 60,
        metrics: { sunlight_percent: 100, earth_visibility_percent: 0, longest_darkness_hours: 0, longest_earth_gap_hours: duration_hours },
        timeline: Array.from({ length: duration_hours }, (_, hour) => ({ interval_start_utc: at(hour), interval_end_utc: at(hour + 1), sample_utc: at(hour + 0.5), sun_elevation_deg: 5, sun_azimuth_deg: 120, earth_elevation_deg: 0, earth_azimuth_deg: 240, sun_visible: true, earth_visible: false })),
        model: { source: 'NASA JPL Horizons', limitations: ['No terrain obstruction. Visibility is not landing safety.'] },
    };
}
export const terrain = {
    terrain_available: true, pixel: { elevation_m: 10, slope_deg: 2 },
    region: { analysis_radius_m: 1000, mean_slope_deg: 3, maximum_slope_deg: 8, elevation_range_m: 25, valid_data_percentage: 80, requested_area_coverage_percentage: 60 },
    raster: { dataset_limitations: ['Regional raster only.'] }, warnings: [],
};
export const ice = { nearest_water_ice_site: null, warnings: ['No listed reference within the requested radius.'] };
export const mission = {
    id: 'chandrayaan_3', name: 'Chandrayaan-3', country: 'India', operator: 'ISRO', event_time_utc: '2023-08-23T12:32:00Z', time_precision: 'minute', landing_outcome: 'successful_soft_landing',
    marker_location: { latitude_deg: -69.3741, longitude_deg: 32.32, coordinate_quality: 'confirmed' },
    replay: { status: 'eligible', location_field: 'actual_location', label: 'Actual landing site' },
    actual_location: { latitude_deg: -69.3741, longitude_deg: 32.32, coordinate_quality: 'confirmed', name: 'Actual site', location_type: 'actual_landing', precision_or_uncertainty: 'Documented coordinates' },
    intended_location: { latitude_deg: -69, longitude_deg: 32, name: 'Intended site' },
    mission_objective: 'Explore the Moon.', what_happened: 'Landed.', achievements: 'A string from the actual API contract, not an array.',
    sources: [{ title: 'ISRO', url: 'https://www.isro.gov.in/', supports: 'Landing' }],
};
