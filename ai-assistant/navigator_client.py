"""Read-only client for the local Lunar Compass FastAPI backend."""

import requests


BASE_URL = "http://127.0.0.1:8000"
REQUEST_TIMEOUT_SECONDS = 10
VISIBILITY_TIMEOUT_SECONDS = 45


class NavigatorClientError(Exception):
    """Base exception for Lunar Compass backend request failures."""


class NavigatorConnectionError(NavigatorClientError):
    """The backend could not be reached."""


class NavigatorTimeoutError(NavigatorClientError):
    """The backend did not respond before the request timeout."""


class NavigatorHTTPError(NavigatorClientError):
    """The backend returned an unsuccessful HTTP status."""


class NavigatorResponseError(NavigatorClientError):
    """The backend response was not valid JSON."""


def request_json(method, path, payload=None, timeout=REQUEST_TIMEOUT_SECONDS):
    """Make one backend request and return its actual JSON response."""
    url = f"{BASE_URL}{path}"

    try:
        response = requests.request(
            method,
            url,
            json=payload,
            timeout=timeout,
        )
    except requests.Timeout as exc:
        raise NavigatorTimeoutError(
            f"Lunar Compass backend request timed out after "
            f"{timeout} seconds."
        ) from exc
    except requests.ConnectionError as exc:
        raise NavigatorConnectionError(
            f"Could not connect to the Lunar Compass backend at {BASE_URL}."
        ) from exc
    except requests.RequestException as exc:
        raise NavigatorClientError(
            f"Lunar Compass backend request failed: {exc}"
        ) from exc

    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise NavigatorHTTPError(
            f"Lunar Compass backend returned HTTP {response.status_code}."
        ) from exc

    try:
        return response.json()
    except ValueError as exc:
        raise NavigatorResponseError(
            "Lunar Compass backend returned a response that was not valid JSON."
        ) from exc


def analyze_visibility(payload):
    """POST visibility inputs and return the backend's JSON result."""
    return request_json(
        "POST",
        "/api/analyze",
        payload,
        timeout=VISIBILITY_TIMEOUT_SECONDS,
    )


def find_nearby_ice(payload):
    """POST a site query and return nearby ice-reference results."""
    return request_json("POST", "/api/analyze-site", payload)


def get_historical_missions():
    """GET historical mission records from the backend."""
    return request_json("GET", "/api/missions")


def analyze_terrain(payload):
    """POST terrain inputs and return the backend's JSON result."""
    return request_json("POST", "/api/terrain/analyze", payload)


def compare_sites(payload):
    """POST candidate locations and return the backend's comparison."""
    return request_json("POST", "/api/compare", payload)
