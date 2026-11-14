import { describe, expect, it } from "vitest";
import { assertMissionWindow, missionEndUtc } from "./missionWindow";

describe("mission window", () => {
  it("preserves explicit UTC and produces the six-day end", () => {
    const window = { start_utc: "2026-11-20T00:00:00Z", duration_hours: 144 };
    expect(assertMissionWindow(window)).toEqual(window);
    expect(missionEndUtc(window)).toBe("2026-11-26T00:00:00Z");
  });
  it("rejects a timezone-free timestamp", () => {
    expect(() => assertMissionWindow({ start_utc: "2026-11-20T00:00:00", duration_hours: 144 })).toThrow("UTC");
  });
  it("rejects an impossible UTC calendar date", () => {
    expect(() => assertMissionWindow({ start_utc: "2026-02-31T00:00:00Z", duration_hours: 144 })).toThrow("invalid");
  });
});
