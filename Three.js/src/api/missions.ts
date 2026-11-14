import { postJson, requestJson } from "./client";
import type { HistoricalReplayResponse, MissionDetail, MissionSummary } from "./types";

export const listMissions = () => requestJson<MissionSummary[]>("/api/missions");
export const getMission = (missionId: string) => requestJson<MissionDetail>(`/api/missions/${encodeURIComponent(missionId)}`);
export const replayMission = (missionId: string, duration_hours = 144, signal?: AbortSignal) => postJson<HistoricalReplayResponse>(`/api/missions/${encodeURIComponent(missionId)}/replay`, { duration_hours }, signal);
