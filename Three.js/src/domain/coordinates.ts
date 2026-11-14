export type LunarCoordinate = { latitude_deg: number; longitude_deg: number };

export function normalizeEastPositiveLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) throw new Error("Longitude must be a finite number.");
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -180) ? 180 : wrapped;
}

export function assertCoordinate(value: LunarCoordinate): LunarCoordinate {
  if (!Number.isFinite(value.latitude_deg) || value.latitude_deg < -90 || value.latitude_deg > 90) {
    throw new Error("Latitude must be between -90° and +90°.");
  }
  return { latitude_deg: value.latitude_deg, longitude_deg: normalizeEastPositiveLongitude(value.longitude_deg) };
}

export function formatCoordinate(value: LunarCoordinate): string {
  const coordinate = assertCoordinate(value);
  const latitudeHemisphere = coordinate.latitude_deg < 0 ? "S" : "N";
  const longitudeHemisphere = coordinate.longitude_deg < 0 ? "W" : "E";
  return `${Math.abs(coordinate.latitude_deg).toFixed(4)}° ${latitudeHemisphere}, ${Math.abs(coordinate.longitude_deg).toFixed(4)}° ${longitudeHemisphere}`;
}
