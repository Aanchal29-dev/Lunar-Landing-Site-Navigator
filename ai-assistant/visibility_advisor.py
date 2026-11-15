"""Deterministic explanations of backend Sun and Earth visibility results."""

import math
import re
from datetime import datetime, timedelta


DEMO_START_UTC = "2026-11-17T00:00:00Z"
DEMO_DURATION_HOURS = 24

_VISIBILITY_TERMS = re.compile(
    r"\b(?:sunlight|sunlit|illumination|illuminated|daylight|darkness|"
    r"earth visibility|earth visible|earth view|earth-view|"
    r"direct[- ](?:to[- ])?earth|"
    r"communication gap|earth gap)\b",
    re.I,
)
_ENDURANCE_TERMS = re.compile(
    r"\b(?:stay duration|total stay|endurance|remain operational|"
    r"stay|remain|operate|survive)\b",
    re.I,
)
_LOCATION_TERMS = re.compile(
    r"\b(?:mons mouton|mmo01|this (?:site|location)|selected (?:site|location)|"
    r"here|there|at (?:the )?(?:lunar )?(?:south pole|site|location)|"
    r"lunar (?:south )?(?:pole|surface)|landing site)\b",
    re.I,
)


def is_visibility_question(question):
    """Match location-specific visibility or surface-endurance questions."""
    location_specific = bool(_LOCATION_TERMS.search(question))
    asks_visibility = bool(_VISIBILITY_TERMS.search(question))
    asks_endurance = bool(_ENDURANCE_TERMS.search(question))
    return location_specific and (asks_visibility or asks_endurance)


def _valid_number(value):
    if isinstance(value, bool):
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def _format_metric(value, suffix):
    number = _valid_number(value)
    if number is None:
        return "Not provided by the backend"
    if suffix == "%":
        return f"{number:.1f}%"
    if number.is_integer():
        return f"{int(number)} {suffix}"
    return f"{number:g} {suffix}"


def _sampled_interval_counts(result):
    timeline = result.get("timeline")
    if not isinstance(timeline, list):
        return None

    valid_samples = [sample for sample in timeline if isinstance(sample, dict)]
    if not valid_samples:
        return None

    sun_samples = [
        sample["sun_visible"]
        for sample in valid_samples
        if isinstance(sample.get("sun_visible"), bool)
    ]
    earth_samples = [
        sample["earth_visible"]
        for sample in valid_samples
        if isinstance(sample.get("earth_visible"), bool)
    ]

    sampling_minutes = _valid_number(result.get("sampling_minutes"))
    if sampling_minutes is not None and sampling_minutes > 0:
        sample_hours = sampling_minutes / 60
    else:
        duration = _valid_number(result.get("duration_hours"))
        sample_hours = duration / len(valid_samples) if duration and duration > 0 else None

    return {
        "sun_samples": len(sun_samples),
        "sunlit": sum(value is True for value in sun_samples),
        "earth_samples": len(earth_samples),
        "earth_visible": sum(value is True for value in earth_samples),
        "sample_hours": sample_hours,
    }


def _sampled_hours(count, interval_hours):
    if interval_hours is None:
        return "approximate sampled hours unavailable"
    return f"approximately {count * interval_hours:g} hours"


def _window_end(start_utc, duration_hours):
    parsed = datetime.fromisoformat(start_utc.replace("Z", "+00:00"))
    return (parsed + timedelta(hours=duration_hours)).isoformat().replace("+00:00", "Z")


def format_visibility_response(
    result, site_name, latitude, longitude, question=""
):
    """Format backend metrics and its model metadata without inferred results."""
    window_end = _window_end(DEMO_START_UTC, DEMO_DURATION_HOURS)
    lines = [
        f"**Selected demonstration location:** {site_name} "
        f"({latitude}, {longitude})",
        "These coordinates come from the local site catalog, not the saved mission.",
        f"**Evaluated UTC window:** {DEMO_START_UTC} to {window_end} "
        f"({DEMO_DURATION_HOURS} hours)",
        "",
    ]

    if not isinstance(result, dict):
        lines.append(
            "The backend response did not contain a usable result object. "
            "No visibility measurements were substituted."
        )
        return "\n\n".join(lines)

    metrics = result.get("metrics")
    if not isinstance(metrics, dict):
        metrics = {}
    counts = _sampled_interval_counts(result)

    lines.extend([
        f"**Sunlight visibility:** {_format_metric(metrics.get('sunlight_percent'), '%')}",
        f"**Sunlit sampled intervals:** "
        + (
            f"{counts['sunlit']} of {counts['sun_samples']} valid samples "
            f"({ _sampled_hours(counts['sunlit'], counts['sample_hours']) })"
            if counts and counts["sun_samples"] else
            "Not available; the response contained no valid Sun visibility samples"
        ),
        f"**Earth visibility:** "
        f"{_format_metric(metrics.get('earth_visibility_percent'), '%')}",
        f"**Earth-visible sampled intervals:** "
        + (
            f"{counts['earth_visible']} of {counts['earth_samples']} valid samples "
            f"({ _sampled_hours(counts['earth_visible'], counts['sample_hours']) })"
            if counts and counts["earth_samples"] else
            "Not available; the response contained no valid Earth visibility samples"
        ),
        f"**Longest darkness interval:** "
        f"{_format_metric(metrics.get('longest_darkness_hours'), 'hours')}",
        f"**Longest Earth-visibility gap:** "
        f"{_format_metric(metrics.get('longest_earth_gap_hours'), 'hours')}",
    ])

    model = result.get("model")
    if not isinstance(model, dict):
        model = {}
    source = model.get("source") or "Not provided by the backend"
    method = model.get("sampling_method") or "Not provided by the backend"
    if method == "hourly_midpoints":
        method = "hourly midpoint sampling"
    horizon = model.get("horizon_degrees")
    if horizon is None or horizon == 0:
        horizon_description = "zero-degree geometric horizon"
    else:
        horizon_description = f"{horizon}-degree geometric horizon"

    lines.extend([
        "",
        f"**NASA data source:** {source}",
        f"**Backend sampling method:** {method}; simplified {horizon_description}.",
        "The backend uses hourly midpoint samples. It does not include local "
        "terrain shadows, and visibility does not certify solar power or radio "
        "communication.",
        "Earth visibility is geometric line of sight; it does not establish "
        "connectivity to an active NASA or ISRO ground station.",
        "Visible sunlight alone does not establish that a rover can remain "
        "operational; battery capacity, solar panels, temperature, and mission "
        "constraints require separate analysis.",
    ])

    if is_endurance_question(question):
        lines.extend([
            "",
            f"This result evaluates only the {DEMO_DURATION_HOURS}-hour observation "
            "window shown above. It does not determine total rover stay duration "
            "or endurance; additional visibility analysis and rover engineering "
            "inputs are required.",
        ])

    return "\n\n".join(lines)


def is_endurance_question(question):
    return bool(_ENDURANCE_TERMS.search(question))


def fetch_visibility_response(site_name, latitude, longitude, analyze_visibility, question=""):
    """Call the backend for the fixed demo window and format its actual response."""
    payload = {
        "latitude_deg": latitude,
        "longitude_deg": longitude,
        "start_utc": DEMO_START_UTC,
        "duration_hours": DEMO_DURATION_HOURS,
    }
    result = analyze_visibility(payload)
    return format_visibility_response(
        result, site_name, latitude, longitude, question
    )
