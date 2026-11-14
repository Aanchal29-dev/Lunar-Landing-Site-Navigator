import { describe, expect, it } from "vitest";
import { INITIAL_PLAN_STATE, planReducer } from "./planReducer";

describe("plan reducer", () => {
  it("keeps a selected location in the shared plan", () => {
    const next = planReducer(INITIAL_PLAN_STATE, { type: "select-site", site: { latitude_deg: -85.2, longitude_deg: 222.5, label: "A" } });
    expect(next.selectedSite).toMatchObject({ latitude_deg: -85.2, longitude_deg: -137.5, label: "A" });
  });
  it("does not add the same comparison coordinate twice", () => {
    const site = { latitude_deg: -85.2, longitude_deg: 32.5, label: "A" };
    const first = planReducer(INITIAL_PLAN_STATE, { type: "add-comparison-site", site });
    expect(planReducer(first, { type: "add-comparison-site", site }).comparisonSites).toHaveLength(1);
  });
});
