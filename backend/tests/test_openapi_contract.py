import json
from pathlib import Path

from app.main import create_app


def test_checked_in_openapi_contract_matches_application():
    contract_path = Path(__file__).resolve().parents[1] / "openapi.json"
    checked_in = json.loads(contract_path.read_text(encoding="utf-8"))
    assert checked_in == create_app().openapi()
    assert set(checked_in["paths"]) == {
        "/api/analyze",
        "/api/assistant/chat",
        "/api/assistant/status",
        "/api/analyze-site",
        "/api/compare",
        "/api/mission-windows",
        "/api/missions",
        "/api/missions/{mission_id}",
        "/api/missions/{mission_id}/replay",
        "/api/stress-test",
        "/api/terrain/analyze",
        "/health",
        "/health/ready",
    }
