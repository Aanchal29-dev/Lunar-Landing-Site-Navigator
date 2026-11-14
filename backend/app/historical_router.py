"""Routes for the Historical Mission Explorer."""

from fastapi import APIRouter, HTTPException, Query

from .historical_models import MissionDetail, MissionSummary
from .services.historical_missions import get_mission_detail, list_mission_summaries

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
