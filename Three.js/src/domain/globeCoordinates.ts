import { assertCoordinate, normalizeEastPositiveLongitude, type LunarCoordinate } from "./coordinates";

export type SurfaceVector = Readonly<{ x: number; y: number; z: number }>;

const DEGREES_PER_RADIAN = 180 / Math.PI;
const RADIANS_PER_DEGREE = Math.PI / 180;

/**
 * Converts lunar planetocentric latitude and east-positive longitude to the
 * local coordinate frame used by the interactive globe. The prime meridian is
 * +X and eastward longitudes rotate toward -Z.
 */
export function lunarCoordinateToSurfaceVector(coordinate: LunarCoordinate, radius = 1): SurfaceVector {
  const { latitude_deg, longitude_deg } = assertCoordinate(coordinate);
  if (!Number.isFinite(radius) || radius <= 0) throw new Error("Globe radius must be positive.");
  const latitude = latitude_deg * RADIANS_PER_DEGREE;
  const longitude = longitude_deg * RADIANS_PER_DEGREE;
  const cosLatitude = Math.cos(latitude);
  return {
    x: radius * cosLatitude * Math.cos(longitude),
    y: radius * Math.sin(latitude),
    z: -radius * cosLatitude * Math.sin(longitude),
  };
}

/** Converts an intersected globe surface point back to the canonical API coordinate. */
export function surfaceVectorToLunarCoordinate(vector: SurfaceVector): LunarCoordinate {
  const radius = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(radius) || radius === 0) throw new Error("Surface vector must have a non-zero finite length.");
  const latitude_deg = Math.asin(Math.max(-1, Math.min(1, vector.y / radius))) * DEGREES_PER_RADIAN;
  const longitude_deg = normalizeEastPositiveLongitude(Math.atan2(-vector.z, vector.x) * DEGREES_PER_RADIAN);
  return assertCoordinate({ latitude_deg, longitude_deg });
}
