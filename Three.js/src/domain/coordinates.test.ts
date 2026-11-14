import { describe, expect, it } from "vitest";
import { assertCoordinate, normalizeEastPositiveLongitude } from "./coordinates";

describe("lunar coordinate domain", () => {
  it("normalizes east-positive longitudes to the backend's signed representation", () => {
    expect(normalizeEastPositiveLongitude(222.498015)).toBeCloseTo(-137.501985);
    expect(normalizeEastPositiveLongitude(-180)).toBe(180);
    expect(normalizeEastPositiveLongitude(360)).toBe(0);
  });
  it("rejects latitude outside the lunar range", () => {
    expect(() => assertCoordinate({ latitude_deg: -91, longitude_deg: 0 })).toThrow("Latitude");
  });
});
