"""API endpoint for lunar south-pole water-ice proximity planning."""

from fastapi import APIRouter

from app.services.water_ice import analyze_site
from app.water_ice_models import AnalyzeSiteRequest, AnalyzeSiteResponse


router = APIRouter(prefix="/api", tags=["Water Ice Navigation"])


@router.post("/analyze-site", response_model=AnalyzeSiteResponse)
def analyze_landing_site(request: AnalyzeSiteRequest) -> AnalyzeSiteResponse:
    """Find nearby source-backed ice evidence and return a map planning line."""

    return analyze_site(request)
