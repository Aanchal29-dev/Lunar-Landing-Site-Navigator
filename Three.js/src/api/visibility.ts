import { postJson } from "./client";
import type { AnalysisRequest, AnalysisResponse } from "./types";
import { assertAnalysisResponse } from "./validateAnalysis";

export async function analyzeVisibility(body: AnalysisRequest, signal?: AbortSignal): Promise<AnalysisResponse> {
  return assertAnalysisResponse(await postJson<unknown>("/api/analyze", body, signal));
}
