"""Ground assistant answers in project services; use Groq only for prose."""

import os
import re

import httpx

from app.assistant.models import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantCitation,
    AssistantStatus,
)
from app.models import AnalysisRequest
from app.services.visibility import analyze_visibility

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b"
HORIZONS_CITATION = AssistantCitation(
    title="NASA JPL Horizons System",
    url="https://ssd.jpl.nasa.gov/horizons/",
)
_VISIBILITY_WORDS = frozenset({"sun", "sunlight", "earth", "visibility", "visible", "dark", "darkness", "communication", "horizon"})


def configured_model() -> str | None:
    """Return a provider model only when a non-empty server-side key exists."""
    return os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL).strip() if os.getenv("GROQ_API_KEY", "").strip() else None


def status() -> AssistantStatus:
    model = configured_model()
    if model:
        return AssistantStatus(configured=True, model=model, detail="Server-side exploration assistant is available.")
    return AssistantStatus(
        configured=False,
        detail="The exploration assistant is not configured. Set GROQ_API_KEY on the backend; visibility analysis remains available.",
    )


def _asks_about_visibility(message: str) -> bool:
    words = set(re.findall(r"[a-z]+", message.lower()))
    return bool(words & _VISIBILITY_WORDS)


def _visibility_summary(analysis) -> str:
    metrics = analysis.metrics
    first = analysis.timeline[0]
    return (
        f"For the selected {analysis.duration_hours}-hour UTC window, the existing NASA JPL Horizons "
        f"visibility engine reports Sun above the geometric horizon for {metrics.sunlight_percent:.1f}% "
        f"of hourly midpoint samples and Earth above it for {metrics.earth_visibility_percent:.1f}%. "
        f"The longest sampled darkness period is {metrics.longest_darkness_hours} h and the longest "
        f"sampled Earth-visibility gap is {metrics.longest_earth_gap_hours} h. The first midpoint "
        f"({first.sample_utc.isoformat().replace('+00:00', 'Z')}) has Sun elevation "
        f"{first.sun_elevation_deg:.2f}° and Earth elevation {first.earth_elevation_deg:.2f}°. "
        "These are apparent airless, zero-degree geometric-horizon estimates; terrain blockage, power, "
        "and communications margins are not modeled."
    )


async def answer(request: AssistantChatRequest, http_client: httpx.AsyncClient) -> AssistantChatResponse:
    """Answer a bounded request without introducing a second astronomy calculation path."""
    if _asks_about_visibility(request.message):
        if not request.context.has_visibility_window():
            return AssistantChatResponse(
                status="needs_input",
                answer="To calculate Sun or Earth visibility, choose a site and provide a UTC start time and duration. No numerical visibility result has been assumed.",
            )
        analysis = await analyze_visibility(
            AnalysisRequest(
                latitude_deg=request.context.latitude_deg,
                longitude_deg=request.context.longitude_deg,
                start_utc=request.context.start_utc,
                duration_hours=request.context.duration_hours,
            ),
            http_client,
        )
        return AssistantChatResponse(
            status="ok",
            answer=_visibility_summary(analysis),
            citations=[HORIZONS_CITATION],
            used_visibility_engine=True,
        )

    model = configured_model()
    if not model:
        return AssistantChatResponse(
            status="unavailable",
            answer="The optional exploration assistant is not configured on this server. Set GROQ_API_KEY to enable general science questions; use the mission tools for calculated results.",
        )

    prompt = (
        "You are the Lunar Compass exploration assistant. Give concise, cautious lunar-science guidance. "
        "Do not invent numerical ephemeris, terrain, ice, safety, or mission results. State when a user must "
        "run a project tool for a calculation. Do not claim terrain-safe routes or operational readiness.\n\n"
        f"User question: {request.message}"
    )
    try:
        response = await http_client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}", "Content-Type": "application/json"},
            json={"model": model, "temperature": 0, "max_tokens": 500, "messages": [{"role": "user", "content": prompt}]},
            timeout=httpx.Timeout(30.0, connect=10.0),
        )
        response.raise_for_status()
        payload = response.json()
        content = payload["choices"][0]["message"]["content"].strip()
        if not isinstance(content, str) or not content:
            raise ValueError("empty provider response")
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return AssistantChatResponse(
            status="unavailable",
            answer="The exploration assistant could not produce a response. No scientific result has been assumed; please retry or use the project analysis tools.",
        )
    return AssistantChatResponse(status="ok", answer=content)
