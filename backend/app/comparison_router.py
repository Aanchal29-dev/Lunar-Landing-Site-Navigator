import httpx
from fastapi import APIRouter, Depends, Request

from app.comparison_models import (
    CompareRequest,
    CompareResponse,
    MissionWindowsRequest,
    MissionWindowsResponse,
    StressTestRequest,
    StressTestResponse,
)
from app.comparison_service import (
    compare_locations_service,
    mission_windows_service,
    stress_test_service,
)

router = APIRouter(prefix="/api", tags=["Comparison & Stress Test"])


def _get_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http_client


@router.post("/compare", response_model=CompareResponse)
async def compare_locations(
    body: CompareRequest, client: httpx.AsyncClient = Depends(_get_client)
) -> CompareResponse:
    return await compare_locations_service(body, client)


@router.post("/stress-test", response_model=StressTestResponse)
async def stress_test_mission(
    body: StressTestRequest, client: httpx.AsyncClient = Depends(_get_client)
) -> StressTestResponse:
    return await stress_test_service(body, client)


@router.post("/mission-windows", response_model=MissionWindowsResponse)
async def suggest_mission_windows(
    body: MissionWindowsRequest, client: httpx.AsyncClient = Depends(_get_client)
) -> MissionWindowsResponse:
    return await mission_windows_service(body, client)