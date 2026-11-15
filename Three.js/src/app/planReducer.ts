import { assertCoordinate, type LunarCoordinate } from "../domain/coordinates";
import { DEFAULT_MISSION_WINDOW, type MissionWindow } from "../domain/missionWindow";

export type SelectedSite = LunarCoordinate & {
  label: string;
  source?: "user" | "historical";
  sourceNote?: string;
};

export type PlanState = {
  selectedSite: SelectedSite | null;
  missionWindow: MissionWindow;
  comparisonSites: SelectedSite[];
};

export type PlanAction =
  | { type: "select-site"; site: SelectedSite }
  | { type: "set-window"; window: MissionWindow }
  | { type: "add-comparison-site"; site: SelectedSite }
  | { type: "set-comparison-sites"; sites: SelectedSite[] }
  | { type: "remove-comparison-site"; index: number }
  | { type: "reset-plan" };

export const INITIAL_PLAN_STATE: PlanState = {
  selectedSite: null,
  missionWindow: DEFAULT_MISSION_WINDOW,
  comparisonSites: [],
};

function validSite(site: SelectedSite): SelectedSite {
  return {
    ...assertCoordinate(site),
    label: site.label.trim() || "Selected lunar location",
    source: site.source,
    sourceNote: site.sourceNote,
  };
}

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case "select-site":
      return { ...state, selectedSite: validSite(action.site) };
    case "set-window":
      return { ...state, missionWindow: action.window };
    case "add-comparison-site": {
      const site = validSite(action.site);
      if (state.comparisonSites.length >= 3) return state;
      if (state.comparisonSites.some((item) => item.latitude_deg === site.latitude_deg && item.longitude_deg === site.longitude_deg)) return state;
      return { ...state, comparisonSites: [...state.comparisonSites, site] };
    }
    case "set-comparison-sites": {
      const sites: SelectedSite[] = [];
      for (const candidate of action.sites) {
        const site = validSite(candidate);
        if (sites.length < 3 && !sites.some((item) => item.latitude_deg === site.latitude_deg && item.longitude_deg === site.longitude_deg)) sites.push(site);
      }
      return { ...state, comparisonSites: sites };
    }
    case "remove-comparison-site":
      return { ...state, comparisonSites: state.comparisonSites.filter((_, index) => index !== action.index) };
    case "reset-plan":
      return INITIAL_PLAN_STATE;
  }
}
