"""Moon-surface distance, nearby ice-site lookup, and map planning-line utilities."""

from __future__ import annotations

import math

from app.data.water_ice import WATER_ICE_SITES
from app.water_ice_models import (
    AnalyzeSiteRequest,
    AnalyzeSiteResponse,
    Coordinate,
    NavigationPath,
    NearbyWaterIceSite,
)


MOON_RADIUS_KM = 1_737.4


def moon_surface_distance_km(
    start_latitude: float,
    start_longitude: float,
    end_latitude: float,
    end_longitude: float,
) -> float:
    """Return the spherical Haversine distance using the Moon's mean radius."""

    start_lat_rad, start_lon_rad, end_lat_rad, end_lon_rad = map(
        math.radians,
        (start_latitude, start_longitude, end_latitude, end_longitude),
    )
    delta_latitude = end_lat_rad - start_lat_rad
    delta_longitude = end_lon_rad - start_lon_rad
    haversine = (
        math.sin(delta_latitude / 2) ** 2
        + math.cos(start_lat_rad)
        * math.cos(end_lat_rad)
        * math.sin(delta_longitude / 2) ** 2
    )
    # Roundoff can put antipodal or coincident values just outside [0, 1].
    haversine = max(0.0, min(1.0, haversine))
    central_angle = 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))
    return MOON_RADIUS_KM * central_angle


def find_nearby_water_ice_sites(
    latitude: float, longitude: float, radius_km: float
) -> list[NearbyWaterIceSite]:
    """Return source-backed reference sites inside ``radius_km``, nearest first."""

    nearby = []
    for site in WATER_ICE_SITES:
        distance_km = moon_surface_distance_km(
            latitude,
            longitude,
            site["latitude"],
            site["longitude"],
        )
        if distance_km <= radius_km:
            nearby.append(NearbyWaterIceSite(**site, distance_km=round(distance_km, 3)))
    return sorted(nearby, key=lambda site: site.distance_km)


def _to_unit_vector(coordinate: Coordinate) -> tuple[float, float, float]:
    latitude = math.radians(coordinate.latitude)
    longitude = math.radians(coordinate.longitude)
    return (
        math.cos(latitude) * math.cos(longitude),
        math.cos(latitude) * math.sin(longitude),
        math.sin(latitude),
    )


def _to_coordinate(vector: tuple[float, float, float]) -> Coordinate:
    x, y, z = vector
    longitude = math.degrees(math.atan2(y, x))
    latitude = math.degrees(math.atan2(z, math.hypot(x, y)))
    return Coordinate(latitude=round(latitude, 7), longitude=round(longitude, 7))


def generate_navigation_path(
    landing_site: Coordinate, target_site: Coordinate, segments: int
) -> NavigationPath:
    """Generate a great-circle coordinate polyline for frontend map rendering."""

    start_vector = _to_unit_vector(landing_site)
    target_vector = _to_unit_vector(target_site)
    dot_product = max(-1.0, min(1.0, sum(a * b for a, b in zip(start_vector, target_vector))))
    central_angle = math.acos(dot_product)

    if math.isclose(central_angle, 0.0, abs_tol=1e-12):
        coordinates = [landing_site, target_site]
    else:
        sine_angle = math.sin(central_angle)
        coordinates = []
        for step in range(segments + 1):
            fraction = step / segments
            start_weight = math.sin((1 - fraction) * central_angle) / sine_angle
            target_weight = math.sin(fraction * central_angle) / sine_angle
            vector = tuple(
                start_weight * start + target_weight * target
                for start, target in zip(start_vector, target_vector)
            )
            coordinates.append(_to_coordinate(vector))

    coordinates[0] = landing_site
    coordinates[-1] = target_site
    return NavigationPath(coordinates=coordinates)


def analyze_site(request: AnalyzeSiteRequest) -> AnalyzeSiteResponse:
    """Build a local, source-backed ice-site result without terrain route claims."""

    landing_site = Coordinate(latitude=request.lat, longitude=request.lon)
    nearby_sites = find_nearby_water_ice_sites(
        landing_site.latitude,
        landing_site.longitude,
        request.search_radius_km,
    )
    nearest_site = nearby_sites[0] if nearby_sites else None
    navigation_path = None
    if nearest_site is not None:
        navigation_path = generate_navigation_path(
            landing_site,
            Coordinate(latitude=nearest_site.latitude, longitude=nearest_site.longitude),
            request.path_segments,
        )

    warnings = [
        "Ice evidence is heterogeneous: the dataset identifies source-backed PSR reference locations, not deposit boundaries.",
        "The navigation path is a great-circle planning line only and does not account for terrain, illumination, hazards, or rover constraints.",
    ]
    if nearest_site is None:
        warnings.append("No listed reference site falls within the requested search radius.")

    return AnalyzeSiteResponse(
        landing_coordinates=landing_site,
        search_radius_km=request.search_radius_km,
        nearby_water_ice_sites=nearby_sites,
        nearest_water_ice_site=nearest_site,
        navigation_path=navigation_path,
        warnings=warnings,
    )
