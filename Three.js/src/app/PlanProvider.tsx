import { createContext, type Dispatch, type ReactNode, useContext, useEffect, useReducer } from "react";

import { assertCoordinate } from "../domain/coordinates";
import { assertMissionWindow } from "../domain/missionWindow";
import { INITIAL_PLAN_STATE, planReducer, type PlanAction, type PlanState, type SelectedSite } from "./planReducer";

const STORAGE_KEY = "lunar-compass.plan.v1";
type PlanContextValue = { state: PlanState; dispatch: Dispatch<PlanAction> };
const PlanContext = createContext<PlanContextValue | null>(null);

function restoreSite(value: unknown): SelectedSite | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SelectedSite>;
  if (typeof candidate.label !== "string") return null;
  try {
    return {
      ...assertCoordinate({ latitude_deg: Number(candidate.latitude_deg), longitude_deg: Number(candidate.longitude_deg) }),
      label: candidate.label,
      source: candidate.source === "historical" || candidate.source === "user" ? candidate.source : undefined,
      sourceNote: typeof candidate.sourceNote === "string" ? candidate.sourceNote : undefined,
    };
  } catch {
    return null;
  }
}

function restorePlan(): PlanState {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return INITIAL_PLAN_STATE;
    const candidate = JSON.parse(saved) as PlanState;
    return {
      selectedSite: restoreSite(candidate.selectedSite),
      missionWindow: assertMissionWindow(candidate.missionWindow ?? INITIAL_PLAN_STATE.missionWindow),
      comparisonSites: Array.isArray(candidate.comparisonSites)
        ? candidate.comparisonSites.map(restoreSite).filter((site): site is SelectedSite => site !== null).slice(0, 3)
        : [],
    };
  } catch {
    return INITIAL_PLAN_STATE;
  }
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(planReducer, undefined, restorePlan);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  return <PlanContext.Provider value={{ state, dispatch }}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const value = useContext(PlanContext);
  if (!value) throw new Error("usePlan must be used within PlanProvider");
  return value;
}
