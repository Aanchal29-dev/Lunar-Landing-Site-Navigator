"""FastAPI routes for the optional server-side exploration assistant."""

import httpx
from fastapi import APIRouter, Request

from app.assistant.models import AssistantChatRequest, AssistantChatResponse, AssistantStatus
from app.assistant.service import answer, status

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.get("/status", response_model=AssistantStatus)
async def read_status() -> AssistantStatus:
    return status()


@router.post("/chat", response_model=AssistantChatResponse)
async def chat(
    body: AssistantChatRequest, request: Request
) -> AssistantChatResponse:
    return await answer(body, request.app.state.http_client)
