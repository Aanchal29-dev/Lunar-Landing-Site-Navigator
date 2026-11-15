"""Source-backed lunar south-pole PSR and water-ice evidence locations.

Coordinates use planetographic latitude and east-positive signed longitude.
They identify named crater/PSR reference locations rather than a rover-safe
traverse or a mapped boundary of an individual ice deposit.
"""

from __future__ import annotations


WATER_ICE_SITES = [
    {
        "id": "cabeus_lcross_impact_site",
        "name": "Cabeus crater LCROSS impact site",
        "latitude": -84.9,
        "longitude": -35.5,
        "ice_probability": "confirmed at the sampled impact site (5.6 ± 2.9% water ice by mass)",
        "evidence_source": (
            "NASA NTRS: LCROSS Results (2016), "
            "https://ntrs.nasa.gov/citations/20160011273"
        ),
        "description": (
            "LCROSS targeted the permanently shadowed Cabeus crater. The reported "
            "5.6 ± 2.9% is a sampled regolith concentration, not a map-wide probability."
        ),
    },
    {
        "id": "shackleton_crater_psr",
        "name": "Shackleton crater permanently shadowed interior",
        "latitude": -89.9,
        "longitude": 0.0,
        "ice_probability": "candidate; remote-sensing hydrogen and radar evidence, no site-specific abundance",
        "evidence_source": (
            "NASA NTRS: Integration of Lunar Polar Remote-Sensing Data Sets: "
            "Evidence for Ice at the Lunar South Pole (2003), "
            "https://ntrs.nasa.gov/citations/20030007904"
        ),
        "description": (
            "The crater interior is a south-pole PSR. Published remote-sensing evidence "
            "supports an ice candidate designation, not a confirmed extractable deposit."
        ),
    },
]


__all__ = ["WATER_ICE_SITES"]
