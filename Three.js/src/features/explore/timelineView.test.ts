import { describe, expect, it } from "vitest";

import { chartX, chartY, elevationDomain, horizonPoint } from "./timelineView";

describe("visibility visualisation calibration", () => {
  it("draws north at the top of the horizon dial", () => {
    const point = horizonPoint(0, 0);
    expect(point.x).toBeCloseTo(120);
    expect(point.y).toBeCloseTo(42);
    expect(point.belowHorizon).toBe(false);
  });

  it("places negative elevation outside the horizon ring instead of claiming it is visible", () => {
    const point = horizonPoint(90, -10);
    expect(point.x).toBeGreaterThan(198);
    expect(point.belowHorizon).toBe(true);
  });

  it("keeps zero degrees visible in the elevation chart", () => {
    const domain = elevationDomain([{ sun_elevation_deg: 5, earth_elevation_deg: 12 } as never]);
    expect(domain.min).toBeLessThan(0);
    expect(chartY(0, domain)).toBeGreaterThan(chartY(5, domain));
    expect(chartX(0, 1)).toBe(460);
  });
});
