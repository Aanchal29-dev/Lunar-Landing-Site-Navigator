"""Offline tests for the integrated exploration assistant boundary."""

import asyncio

import httpx
from fastapi.testclient import TestClient

from app.assistant.models import AssistantChatRequest
from app.assistant.service import answer
from app.main import create_app


def test_assistant_status_and_general_question_need_no_provider(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with TestClient(create_app()) as client:
        status = client.get("/api/assistant/status")
        response = client.post("/api/assistant/chat", json={"message": "What is lunar ice?"})
    assert status.status_code == 200
    assert status.json()["configured"] is False
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"


def test_visibility_question_requires_real_window_without_calling_upstream():
    request = AssistantChatRequest(message="Will the Sun and Earth be visible?")

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: AssertionError("unexpected request"))) as client:
            return await answer(request, client)

    response = asyncio.run(run())
    assert response.status == "needs_input"
    assert response.used_visibility_engine is False


def test_general_question_uses_configured_server_provider(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "offline-key")
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": "Use the mission tools for calculated results."}}]})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await answer(AssistantChatRequest(message="How should I compare sites?"), client)

    response = asyncio.run(run())
    assert response.status == "ok"
    assert response.answer == "Use the mission tools for calculated results."
    assert len(calls) == 1
    assert str(calls[0].url) == "https://api.groq.com/openai/v1/chat/completions"
    assert calls[0].headers["authorization"] == "Bearer offline-key"


def test_visibility_question_uses_shared_engine_with_selected_context(reports):
    calls = []

    def handler(request):
        calls.append(request)
        target = int(request.url.params["COMMAND"].strip("'"))
        return httpx.Response(200, text=reports[target])

    request = AssistantChatRequest.model_validate({
        "message": "Will the Sun and Earth be visible?",
        "context": {
            "latitude_deg": -85.2, "longitude_deg": 32.5,
            "start_utc": "2026-11-20T00:00:00Z", "duration_hours": 1,
        },
    })

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await answer(request, client)

    response = asyncio.run(run())
    assert response.status == "ok"
    assert response.used_visibility_engine is True
    assert [request.url.params["COMMAND"] for request in calls] == ["'10'", "'399'"]
    assert all(request.url.params["SITE_COORD"] == "'32.500000000000,-85.200000000000,0'" for request in calls)
    assert "100.0%" in response.answer
