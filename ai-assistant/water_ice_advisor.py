"""Deterministic matching and formatting for water-ice proximity questions."""

import re


_ICE_TERMS = re.compile(r"\b(?:water[ -]ice|lunar ice|ice deposits?)\b", re.I)
_PROXIMITY_TERMS = re.compile(
    r"\b(?:nearest|closest|nearby|distance|how far|proximity|sites?|locations?)\b",
    re.I,
)
_MARKDOWN_LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")
_URL = re.compile(r"https?://\S+")


def is_water_ice_proximity_question(question):
    """Return true only for an ice question asking about locations/distance."""
    return bool(_ICE_TERMS.search(question) and _PROXIMITY_TERMS.search(question))


def _walk_mappings(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _walk_mappings(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_mappings(child)


def _get_first(mapping, keys):
    for key in keys:
        value = mapping.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def _site_records(data):
    records = []
    seen = set()
    name_keys = ("name", "site_name", "location_name", "crater", "site")
    distance_keys = ("distance_km", "distanceKm", "distance_in_km")

    for item in _walk_mappings(data):
        name = _get_first(item, name_keys)
        distance = _get_first(item, distance_keys)
        if name is None or distance is None:
            continue
        try:
            numeric_distance = float(distance)
        except (TypeError, ValueError):
            continue
        if numeric_distance < 0:
            continue
        identity = (str(name), str(distance))
        if identity not in seen:
            seen.add(identity)
            records.append(item)

    def distance_value(record):
        try:
            return float(_get_first(record, distance_keys))
        except (TypeError, ValueError):
            return float("inf")

    return sorted(records, key=distance_value)


def _source_links(data):
    links = []
    seen = set()
    for item in _walk_mappings(data):
        evidence_source = item.get("evidence_source")
        parsed_source = _parse_evidence_source(evidence_source)
        if parsed_source:
            title, url = parsed_source
            if url not in seen:
                seen.add(url)
                links.append((title, url))

        url = _get_first(item, ("url", "source_url", "citation_url"))
        if isinstance(url, str) and url.startswith(("https://", "http://")):
            title = _get_first(item, ("title", "name", "label")) or url
            if url not in seen:
                seen.add(url)
                links.append((str(title), url))
        for source_key in ("sources", "source_urls"):
            sources = item.get(source_key)
            if isinstance(sources, list):
                for source in sources:
                    if isinstance(source, str) and source.startswith(("https://", "http://")):
                        if source not in seen:
                            seen.add(source)
                            links.append((source, source))
    return links


def _parse_evidence_source(value):
    """Extract only a URL and title that the backend included in its source."""
    if not isinstance(value, str):
        return None

    markdown_link = _MARKDOWN_LINK.search(value)
    if markdown_link:
        title = value[:markdown_link.start()].strip(" ,;:")
        if not title:
            title = markdown_link.group(1)
        return title, markdown_link.group(2)

    url_match = _URL.search(value)
    if url_match:
        title = value[:url_match.start()].strip(" ,;:") or url_match.group(0)
        return title, url_match.group(0).rstrip(".,;)")
    return None


def _format_evidence_source(value):
    parsed_source = _parse_evidence_source(value)
    if parsed_source:
        title, url = parsed_source
        return f"[{title}]({url})"
    return value if isinstance(value, str) and value else "Not provided in the response."


def _format_site_details(record, include_bullet=False):
    name = _get_first(record, ("name", "site_name", "location_name", "crater", "site"))
    distance = float(_get_first(
        record, ("distance_km", "distanceKm", "distance_in_km")
    ))
    prefix = "- " if include_bullet else ""
    lines = [f"{prefix}{name}: {distance:.3f} km"]

    ice_evidence = record.get("ice_probability")
    if ice_evidence:
        lines.append(f"  - Ice evidence / confidence: {ice_evidence}")
    description = record.get("description")
    if description:
        lines.append(f"  - Scientific explanation: {description}")
    evidence_source = record.get("evidence_source")
    if evidence_source:
        lines.append(f"  - Evidence source: {_format_evidence_source(evidence_source)}")
    return lines


def fetch_water_ice_response(site_name, latitude, longitude, find_ice):
    """Fetch and format ice references for the supplied demo coordinates."""
    payload = {
        "lat": latitude,
        "lon": longitude,
        "search_radius_km": 250,
    }
    data = find_ice(payload)
    return format_water_ice_response(data, site_name, latitude, longitude)


def format_water_ice_response(data, site_name, latitude, longitude):
    """Format only values and references present in the backend response."""
    records = _site_records(data)
    lines = [
        "**Selected demonstration location:** "
        f"{site_name} ({latitude}, {longitude})",
        "These are demonstration coordinates selected from the local site catalog; "
        "they are not inferred from the saved mission.",
        "",
    ]

    if records:
        nearest = records[0]
        name = _get_first(nearest, ("name", "site_name", "location_name", "crater", "site"))
        distance = float(_get_first(nearest, ("distance_km", "distanceKm", "distance_in_km")))
        lines.extend([
            f"**Nearest listed water-ice reference site:** {name}",
            f"**Distance:** {distance:.3f} km",
        ])
        lines.extend(_format_site_details(nearest)[1:])
        lines.extend(["", "**Other listed nearby sites:**"])
        if len(records) > 1:
            for record in records[1:]:
                lines.extend(_format_site_details(record, include_bullet=True))
        else:
            lines.append("- No other nearby sites were listed in the backend response.")
    else:
        lines.append(
            "The backend response did not include a nearby site with a name and "
            "distance in kilometers. No measurements have been substituted."
        )

    lines.extend([
        "",
        "These are documented reference locations or ice candidates, not confirmation "
        "of an accessible deposit or a complete map of lunar ice. Any navigation line "
        "is a geometric reference only; it is not a safe rover route.",
    ])

    sources = _source_links(data)
    if sources:
        lines.extend(["", "### Sources"])
        for index, (title, url) in enumerate(sources, start=1):
            lines.append(f"[{index}] {title} — {url}")
    else:
        lines.extend(["", "**Source URLs:** Not provided in the backend response."])

    return "\n\n".join(lines).replace("\n\n- ", "\n- ")
