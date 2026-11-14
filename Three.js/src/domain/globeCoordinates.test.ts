import { describe, expect, it } from "vitest";

import { lunarCoordinateToSurfaceVector, surfaceVectorToLunarCoordinate } from "./globeCoordinates";

describe("interactive globe coordinate calibration", () => {
  it("uses east-positive longitude: 90°E points toward negative Z", () => {
    const vector = lunarCoordinateToSurfaceVector({ latitude_deg: 0, longitude_deg: 90 });
    expect(vector.x).toBeCloseTo(0);
    expect(vector.y).toBeCloseTo(0);
    expect(vector.z).toBeCloseTo(-1);
  });

  it("round-trips a selected lunar surface point into canonical API coordinates", () => {
    const coordinate = { latitude_deg: -69.3741, longitude_deg: 32.32 };
    const restored = surfaceVectorToLunarCoordinate(lunarCoordinateToSurfaceVector(coordinate));
    expect(restored.latitude_deg).toBeCloseTo(coordinate.latitude_deg, 8);
    expect(restored.longitude_deg).toBeCloseTo(coordinate.longitude_deg, 8);
  });

  it("normalizes a westward surface point into the signed canonical range", () => {
    const restored = surfaceVectorToLunarCoordinate({ x: 0, y: 0, z: 1 });
    expect(restored).toEqual({ latitude_deg: 0, longitude_deg: -90 });
  });
});
