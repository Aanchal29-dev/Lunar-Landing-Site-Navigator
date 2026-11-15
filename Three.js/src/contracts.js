export function toVisibilityLongitude(eastLongitudeDegrees) {
    if (!Number.isFinite(eastLongitudeDegrees)) throw new Error('Longitude must be a finite number.');
    const normalized = ((eastLongitudeDegrees % 360) + 360) % 360;
    return normalized > 180 ? normalized - 360 : normalized;
}

export function parseCoordinate(input, axis, defaultHemisphere) {
    const match = String(input).trim().match(/^([+-]?)(\d+(?:\.\d*)?|\.\d+)\s*°?\s*([NSEW])?$/i);
    if (!match) throw new Error(`Enter a valid ${axis}; trailing text and multiple signs are not allowed.`);
    const negative = axis === 'latitude' ? 'S' : 'W';
    const positive = axis === 'latitude' ? 'N' : 'E';
    const letter = match[3]?.toUpperCase();
    if (letter && ![positive, negative].includes(letter)) throw new Error(`Use ${positive} or ${negative} for ${axis}.`);
    if (letter && ((match[1] === '-' && letter === positive) || (match[1] === '+' && letter === negative))) throw new Error('Coordinate sign and hemisphere disagree.');
    const hemisphere = letter || (match[1] === '-' ? negative : match[1] === '+' ? positive : defaultHemisphere);
    const magnitude = Number(match[2]);
    const limit = axis === 'latitude' ? 90 : hemisphere === 'W' ? 180 : 360;
    if (!Number.isFinite(magnitude) || magnitude > limit) throw new Error(`${axis} must be between 0 and ${limit}° ${hemisphere}.`);
    const signed = hemisphere === negative ? -magnitude : magnitude;
    return { value: axis === 'longitude' ? ((signed % 360) + 360) % 360 : signed, hemisphere };
}

export function missionWindow(date, time, duration) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Enter a valid UTC date and time.');
    const start_utc = `${date}T${time}:00Z`;
    const parsed = new Date(start_utc);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== start_utc.slice(0, 19) || parsed.getUTCFullYear() < 1962) throw new Error('Enter a valid UTC date in 1962 or later.');
    const duration_hours = Number(duration);
    if (!String(duration).trim() || !Number.isInteger(duration_hours) || duration_hours < 1 || duration_hours > 336) throw new Error('Duration must be a whole number from 1 to 336 hours.');
    return { start_utc, duration_hours };
}

export function assertAnalysisResponse(payload) {
    if (!payload || !payload.metrics || !Array.isArray(payload.timeline) || payload.timeline.length === 0) {
        throw new Error('The visibility service returned an incomplete analysis.');
    }
    for (const name of ['sunlight_percent', 'earth_visibility_percent', 'longest_darkness_hours', 'longest_earth_gap_hours']) {
        const value = payload.metrics[name];
        const percent = name.endsWith('percent');
        if (!Number.isFinite(value) || value < 0 || value > (percent ? 100 : payload.duration_hours) || (!percent && !Number.isInteger(value))) {
            throw new Error('The visibility service returned invalid metrics.');
        }
    }
    const start = Date.parse(payload.start_utc);
    if (!Number.isInteger(payload.duration_hours) || payload.duration_hours < 1 || payload.duration_hours > 336 || payload.timeline.length !== payload.duration_hours || !Number.isFinite(start) || Date.parse(payload.end_utc) !== start + payload.duration_hours * 3600000 || !Number.isFinite(payload.location?.latitude_deg) || !Number.isFinite(payload.location?.longitude_deg) || !Array.isArray(payload.model?.limitations)) throw new Error('The visibility service returned an invalid mission window.');
    for (const [index, sample] of payload.timeline.entries()) {
        if (Date.parse(sample.sample_utc) !== start + (index + 0.5) * 3600000 || Date.parse(sample.interval_start_utc) !== start + index * 3600000 || Date.parse(sample.interval_end_utc) !== start + (index + 1) * 3600000) throw new Error('The visibility service returned misaligned hourly samples.');
        for (const body of ['sun', 'earth']) {
            const elevation = sample[`${body}_elevation_deg`], azimuth = sample[`${body}_azimuth_deg`];
            if (!Number.isFinite(elevation) || Math.abs(elevation) > 90 || !Number.isFinite(azimuth) || azimuth < 0 || azimuth > 360 || sample[`${body}_visible`] !== (elevation > 0)) throw new Error('The visibility service returned invalid observer angles.');
        }
    }
    return payload;
}
