import type { TimelineEntry } from "../../api/types";

export type HorizonPoint = Readonly<{ x: number; y: number; belowHorizon: boolean }>;
export type ElevationDomain = Readonly<{ min: number; max: number }>;

const DIAL_CENTER = 120;
const HORIZON_RADIUS = 78;

/** Places an actual Horizons azimuth/elevation sample on a north-up sky dial. */
export function horizonPoint(azimuth_deg: number, elevation_deg: number): HorizonPoint {
  if (!Number.isFinite(azimuth_deg) || !Number.isFinite(elevation_deg)) throw new Error("Sky coordinates must be finite.");
  const belowHorizon = elevation_deg < 0;
  const radialDistance = belowHorizon
    ? HORIZON_RADIUS + Math.min(25, Math.abs(elevation_deg) * 1.5)
    : HORIZON_RADIUS * (1 - Math.min(90, elevation_deg) / 90);
  const angle = (azimuth_deg - 90) * Math.PI / 180;
  return {
    x: DIAL_CENTER + Math.cos(angle) * radialDistance,
    y: DIAL_CENTER + Math.sin(angle) * radialDistance,
    belowHorizon,
  };
}

/** Keeps the geometric horizon visible in every elevation chart domain. */
export function elevationDomain(entries: TimelineEntry[]): ElevationDomain {
  const values = entries.flatMap((entry) => [entry.sun_elevation_deg, entry.earth_elevation_deg]);
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  if (low === high) return { min: low - 1, max: high + 1 };
  const padding = (high - low) * 0.1;
  return { min: low - padding, max: high + padding };
}

export function chartY(value: number, domain: ElevationDomain, height = 180, top = 20): number {
  return top + ((domain.max - value) / (domain.max - domain.min)) * height;
}

export function chartX(index: number, count: number, width = 820, left = 50): number {
  return count <= 1 ? left + width / 2 : left + (index / (count - 1)) * width;
}
