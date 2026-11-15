"""Deterministic proximity estimates for documented lunar mission markers."""

import math
import re


MEAN_LUNAR_RADIUS_KM = 1737.4
MAX_RESULTS = 5

_PROXIMITY_TERMS = re.compile(
    r"\b(?:nearest|closest|nearby|proximity)\b", re.I
)
_DISTANCE_TERMS = re.compile(r"\b(?:distance|how far)\b", re.I)
_LOCATION_CUES = re.compile(
    r"\b(?:near|from|where|located|landing|landed|site|marker|away)\b", re.I
)
_MISSION_TERMS = re.compile(
    r"\b(?:lunar\s+)?missions?|landers?|rovers?|landing\s+sites?\b", re.I
)


def is_historical_mission_proximity_question(question):
    """Match nearby/closest questions about lunar mission location records."""
    asks_about_missions = bool(_MISSION_TERMS.search(question))
    asks_proximity = bool(_PROXIMITY_TERMS.search(question)) or bool(
        _DISTANCE_TERMS.search(question) and _LOCATION_CUES.search(question)
    )
    return asks_about_missions and asks_proximity


def normalize_longitude(longitude_deg):
    """Normalize east-positive longitude, including 0–360 values, to [-180, 180)."""
    return ((longitude_deg + 180.0) % 360.0) - 180.0


def haversine_distance_km(latitude_a, longitude_a, latitude_b, longitude_b):
    """Calculate great-circle distance on a spherical Moon of mean radius."""
    lat_a = math.radians(latitude_a)
    lat_b = math.radians(latitude_b)
    delta_lat = lat_b - lat_a
    delta_lon = math.radians(normalize_longitude(longitude_b - longitude_a))

    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    )
    haversine = min(1.0, max(0.0, haversine))
    return 2 * MEAN_LUNAR_RADIUS_KM * math.asin(math.sqrt(haversine))


def _valid_coordinate(value, minimum, maximum):
    if isinstance(value, bool):
        return False
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(number) and minimum <= number <= maximum


def _mission_locations(missions, target_latitude, target_longitude):
    if not isinstance(missions, list):
        return []

    locations = []
    for mission in missions:
        if not isinstance(mission, dict):
            continue
        marker = mission.get("marker_location")
        if not isinstance(marker, dict):
            continue

        latitude = marker.get("latitude_deg")
        longitude = marker.get("longitude_deg")
        if not (
            _valid_coordinate(latitude, -90, 90)
            and _valid_coordinate(longitude, -180, 360)
        ):
            continue

        latitude = float(latitude)
        longitude = float(longitude)
        distance = haversine_distance_km(
            target_latitude, target_longitude, latitude, longitude
        )
        locations.append({
            "mission": mission,
            "marker": marker,
            "latitude": latitude,
            "longitude": longitude,
            "distance_km": distance,
        })

    return sorted(locations, key=lambda item: item["distance_km"])


def _outcome_category(outcome):
    if not isinstance(outcome, str) or not outcome.strip():
        return "Outcome not provided or not classified"

    normalized = outcome.casefold()
    if any(term in normalized for term in ("impact", "crash", "collision")):
        return "Impact site; not a successful landing"
    if any(term in normalized for term in ("failed", "failure", "unsuccessful")):
        return "Failed landing"
    if "partial success" in normalized:
        return "Partial success; not classified as a successful landing"
    if any(term in normalized for term in (
        "successful", "successfully landed", "soft landing", "landed"
    )):
        return "Successful landing"
    return "Outcome not classified from the provided value"


def _format_record(location, number):
    mission = location["mission"]
    marker = location["marker"]
    name = mission.get("name") or f"Mission record {mission.get('id', 'without name')}"
    country = mission.get("country") or "Not provided"
    outcome = mission.get("landing_outcome") or "Not provided"
    location_type = marker.get("location_type") or "Not provided"
    coordinate_quality = marker.get("coordinate_quality") or "Not provided"

    return (
        f"{number}. **{name}** — {location['distance_km']:.3f} km\n"
        f"   - Country: {country}\n"
        f"   - Landing outcome: {outcome} ({_outcome_category(outcome)})\n"
        f"   - Location type: {location_type}\n"
        f"   - Coordinates: {location['latitude']:.6f}°, "
        f"{location['longitude']:.6f}° east-positive\n"
        f"   - Coordinate quality: {coordinate_quality}"
    )


def format_nearby_historical_missions(
    missions, site_name, target_latitude, target_longitude
):
    """Format up to five valid backend mission markers by great-circle distance."""
    heading = (
        f"**Selected demonstration location:** {site_name} "
        f"({target_latitude}, {target_longitude})\n\n"
        "These coordinates come from the local site catalog, not the saved mission."
    )

    if not isinstance(missions, list):
        return (
            f"{heading}\n\nThe backend returned an unexpected mission-record "
            "format, so no distances could be calculated."
        )
    if not missions:
        return f"{heading}\n\nThe backend returned no historical mission records."

    locations = _mission_locations(
        missions, float(target_latitude), float(target_longitude)
    )
    if not locations:
        return (
            f"{heading}\n\nNo records included valid marker coordinates, so "
            "distances could not be calculated."
        )

    displayed = locations[:MAX_RESULTS]
    formatted_records = "\n\n".join(
        _format_record(location, number)
        for number, location in enumerate(displayed, start=1)
    )
    return (
        f"{heading}\n\n"
        f"**Closest documented lunar mission locations** "
        f"(great-circle distance; mean lunar radius {MEAN_LUNAR_RADIUS_KM} km):\n\n"
        f"{formatted_records}\n\n"
        "These distances are between catalog coordinates, not rover driving "
        "distances. A historical marker does not establish that a spacecraft or "
        "rover is currently operational, reachable, or able to communicate. "
        "The records identify mission locations; they do not separately establish "
        "rover operations unless a record explicitly says so."
    )


def fetch_nearby_historical_missions(
    site_name, latitude, longitude, get_missions
):
    """Fetch backend summaries and format proximity to the supplied demo site."""
    missions = get_missions()
    return format_nearby_historical_missions(
        missions, site_name, latitude, longitude
    )
