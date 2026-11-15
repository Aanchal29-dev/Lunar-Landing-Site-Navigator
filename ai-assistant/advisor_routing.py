"""Deterministic precedence for specialized, project, and legacy chat routes."""

import re

from battery_advisor import is_battery_question
from historical_mission_advisor import is_historical_mission_proximity_question
from project_advisor import is_project_question
from visibility_advisor import is_visibility_question
from water_ice_advisor import is_water_ice_proximity_question


_PROJECT_PREFIX = re.compile(
    r"^\s*(?:in|using|for)\s+(?:lunar compass|our project|our app)\s*[, :]\s*",
    re.I,
)
_DIRECT_SCHEDULE_REQUEST = re.compile(
    r"^\s*(?:please\s+)?(?:schedule|plan|reschedule|create)\b|"
    r"^\s*(?:please\s+)?compare\b.{0,80}\b(?:candidate locations|candidate sites|"
    r"mission windows|start dates|activity windows)\b|"
    r"^\s*(?:i want|i need|help me|can (?:you|i)|could (?:you|i)|i'd like to)\b.{0,60}"
    r"\b(?:schedule|plan|reschedule|mission)\b|"
    r"^\s*(?:change|update|modify|adjust|increase|decrease|shorten|extend)\b"
    r".{0,80}\b(?:mission|duration|sunlight|communication|date|region|objective)\b",
    re.I,
)
_FOLLOWUP_UPDATE = re.compile(
    r"\b(?:change|update|modify|adjust|increase|decrease|shorten|extend|make|set|keep|"
    r"need|want|require|disable|enable|turn off|turn on|no longer)\b"
    r".{0,100}\b(?:duration|hours?|sunlight|communication|date|region|objective|"
    r"mission|everything|same|it)\b",
    re.I,
)


def select_advisor_route(
    question, has_saved_mission=False, classified_intent=None
):
    """Return a specific route or defer to the existing classifier when needed."""
    normalized_question = _PROJECT_PREFIX.sub("", question, count=1)

    # Explicit planning and saved-mission edits must reach the existing scheduler.
    if _DIRECT_SCHEDULE_REQUEST.search(normalized_question):
        return "schedule"
    if has_saved_mission and _FOLLOWUP_UPDATE.search(normalized_question):
        return "schedule"

    # A project prefix describes context; it must not mask a specialized request.
    if is_battery_question(normalized_question):
        return "battery"
    if is_visibility_question(normalized_question):
        return "visibility"
    if is_historical_mission_proximity_question(normalized_question):
        return "historical_mission"
    if is_water_ice_proximity_question(normalized_question):
        return "water_ice"
    if is_project_question(question):
        return "project"

    if classified_intent == "moon_nasa":
        return "nasa_rag"
    if classified_intent == "schedule":
        return "schedule"
    if classified_intent == "other":
        return "other"
    return None
