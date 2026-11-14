"""Routes for the Historical Mission Explorer."""

from fastapi import APIRouter, HTTPException, Query, Request

from app.models import AnalysisRequest
from app.services.visibility import analyze_visibility

from .historical_models import (
    HistoricalReplayResponse,
    MissionDetail,
    MissionSummary,
    ReplayRequest,
)
from .services.historical_missions import (
    get_mission_detail,
    get_replay_input,
    list_mission_summaries,
)

router = APIRouter(prefix="/api/missions", tags=["missions"])


@router.get("", response_model=list[MissionSummary])
def read_missions(
    country: str | None = Query(default=None, min_length=1),
    landing_outcome: str | None = Query(default=None, min_length=1),
) -> list[MissionSummary]:
    """Return compact, source-backed mission records for cards and map markers."""
    try:
        return list_mission_summaries(
            country=country,
            landing_outcome=landing_outcome,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/{mission_id}", response_model=MissionDetail)
def read_mission(mission_id: str) -> MissionDetail:
    """Return one complete verified mission record with its source provenance."""
    try:
        mission = get_mission_detail(mission_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission


def _visibility_longitude(east_positive_longitude: float) -> float:
    """Convert the historical 0..360 convention to the engine's signed convention."""
    return east_positive_longitude if east_positive_longitude <= 180 else east_positive_longitude - 360


@router.post("/{mission_id}/replay", response_model=HistoricalReplayResponse)
async def replay_mission(
    mission_id: str, body: ReplayRequest, request: Request
) -> HistoricalReplayResponse:
    """Run the shared visibility engine for an eligible documented mission site."""
    replay_input = get_replay_input(mission_id, body)
    if replay_input is None:
        if get_mission_detail(mission_id) is None:
            raise HTTPException(status_code=404, detail="Mission not found")
        raise HTTPException(status_code=422, detail="Mission is not eligible for replay")

    analysis_request = AnalysisRequest(
        latitude_deg=replay_input.latitude_deg,
        longitude_deg=_visibility_longitude(replay_input.longitude_deg),
        start_utc=replay_input.start_utc,
        duration_hours=replay_input.duration_hours,
    )
    analysis = await analyze_visibility(analysis_request, request.app.state.http_client)
    return HistoricalReplayResponse(
        analysis=analysis,
        historical_context=replay_input.historical_context,
    )
