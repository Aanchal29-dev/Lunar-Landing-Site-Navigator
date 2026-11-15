import { assertAnalysisResponse } from './contracts.js';

export const text = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
};
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const quantity = (value, unit) => Number.isFinite(value) ? `${value.toFixed(1)} ${unit}` : 'Unavailable';

// Render only backend measurements; missing data never becomes a local estimate.
export function renderMissionResults(analysis, terrain, ice) {
    assertAnalysisResponse(analysis);
    const m = analysis.metrics, first = analysis.timeline[0];
    text('plan-outlook-badge', 'GEOMETRIC VISIBILITY RESULTS');
    text('plan-outlook-meta', `${analysis.duration_hours} HOURLY MIDPOINTS · NASA JPL HORIZONS`);
    text('plan-outlook-statement', `${analysis.start_utc} → ${analysis.end_utc}. Sun visible ${m.sunlight_percent.toFixed(1)}%; Earth visible ${m.earth_visibility_percent.toFixed(1)}%. Visibility does not establish usable power, communications or landing safety.`);
    text('val-earth-los', `${m.earth_visibility_percent.toFixed(1)}% VISIBLE`);
    text('badge-earth-comm', m.earth_visibility_percent > 0 ? 'DIRECT VIEW WINDOWS' : 'NO DIRECT VIEW');
    text('desc-earth-comm', `Earth center elevation is strictly above 0° during ${m.earth_visibility_percent.toFixed(1)}% of the mission. No DSN station visibility or link budget is modeled.`);
    text('val-earth-elevation', `${quantity(first.earth_elevation_deg, '°')} at ${first.sample_utc}`);
    text('val-earth-travel-dist', `${m.longest_earth_gap_hours} h`);
    text('val-earth-nearest-coords', `${analysis.timeline.length} hourly midpoint samples`);
    text('val-solar-state', `${m.sunlight_percent.toFixed(1)}% SUNLIT`);
    text('badge-solar-power', m.sunlight_percent > 0 ? 'SUNLIGHT WINDOWS' : 'NO SUNLIGHT');
    text('desc-solar-power', 'Apparent airless Sun-center elevation above a geometric horizon. Terrain obstruction and eclipses are not included.');
    text('val-plan-solar-elevation', `${quantity(first.sun_elevation_deg, '°')} at ${first.sample_utc}`);
    text('val-plan-sunlit-duration', `${m.sunlight_percent.toFixed(1)}% of ${analysis.duration_hours} h`);
    text('val-plan-sun-dist', `${m.longest_darkness_hours} h`);

    const site = ice?.nearest_water_ice_site;
    text('val-ice-distance', site ? `${site.distance_km} km` : 'Unavailable');
    text('badge-water-ice', site ? 'REFERENCE SITE' : ice?.warnings ? 'NO NEARBY REFERENCE' : 'UNAVAILABLE');
    text('desc-water-ice', ice?.error || [site?.description, ...(ice?.warnings || [])].filter(Boolean).join(' ') || 'Ice reference lookup unavailable.');
    text('val-ice-evidence', site ? `${site.ice_probability}. ${site.evidence_source}` : 'No evidence returned');
    text('val-ice-feature-name', site?.name || 'No listed site within 250 km');
    text('val-ice-coords', site ? `${site.latitude}°, ${site.longitude}° east` : '—');

    const available = terrain?.terrain_available === true;
    text('val-terrain-elevation', available ? quantity(terrain.pixel.elevation_m, 'm') : 'Unavailable');
    text('badge-terrain', available ? 'RASTER MEASUREMENTS' : 'TERRAIN UNAVAILABLE');
    text('desc-terrain', [...(terrain?.warnings || []), ...(terrain?.raster?.dataset_limitations || [])].join(' ') || 'No regional raster measurements returned.');
    text('val-terrain-mean-slope', available ? quantity(terrain.region.mean_slope_deg, '°') : 'Unavailable');
    text('val-terrain-max-slope', available ? quantity(terrain.region.maximum_slope_deg, '°') : 'Unavailable');
    text('val-terrain-range', available ? quantity(terrain.region.elevation_range_m, 'm range') : 'Unavailable');
    text('val-terrain-coverage', terrain?.region ? `${terrain.region.valid_data_percentage}% valid data; ${terrain.region.requested_area_coverage_percentage}% requested-area coverage` : 'Unavailable');

    const track = document.getElementById('plan-timeline-track');
    track.replaceChildren();
    const inspect = sample => text('plan-timeline-inspector-text', `${sample.sample_utc}: Sun ${sample.sun_elevation_deg.toFixed(2)}° elevation, ${sample.sun_azimuth_deg.toFixed(2)}° azimuth; Earth ${sample.earth_elevation_deg.toFixed(2)}° elevation, ${sample.earth_azimuth_deg.toFixed(2)}° azimuth.`);
    for (let day = 0; day < Math.ceil(analysis.timeline.length / 24); day++) {
        const section = document.createElement('div'); section.className = 'plan-timeline-day';
        const label = document.createElement('span'); label.className = 'plan-timeline-day-label'; label.textContent = `DAY ${day + 1}`;
        const blocks = document.createElement('div'); blocks.className = 'plan-timeline-day-blocks';
        analysis.timeline.slice(day * 24, (day + 1) * 24).forEach(sample => {
            const block = document.createElement('button'); block.type = 'button';
            block.className = `timeline-block ${sample.sun_visible ? sample.earth_visible ? 'block-sun-earth' : 'block-sun-only' : sample.earth_visible ? 'block-earth-only' : 'block-dark'}`;
            block.title = sample.sample_utc; block.setAttribute('aria-label', `Inspect ${sample.sample_utc}`);
            for (const event of ['mouseenter', 'focus', 'click']) block.addEventListener(event, () => inspect(sample));
            blocks.append(block);
        });
        section.append(label, blocks); track.append(section);
    }
    inspect(first);
    let limits = document.getElementById('analysis-limitations');
    if (!limits) {
        limits = document.createElement('p'); limits.id = 'analysis-limitations'; limits.className = 'card-explanation';
        document.getElementById('results-content-box').append(limits);
    }
    limits.textContent = analysis.model.limitations.join(' ');
}
