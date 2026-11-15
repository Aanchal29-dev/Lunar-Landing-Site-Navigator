import unittest
from unittest.mock import Mock

from water_ice_advisor import (
    fetch_water_ice_response,
    format_water_ice_response,
    is_water_ice_proximity_question,
)


class WaterIceAdvisorTests(unittest.TestCase):
    def test_recognizes_proximity_questions(self):
        for question in (
            "Where is the nearest lunar water ice?",
            "How far is the closest water-ice site?",
            "Show nearby lunar ice locations",
        ):
            with self.subTest(question=question):
                self.assertTrue(is_water_ice_proximity_question(question))

    def test_does_not_route_general_science_question(self):
        self.assertFalse(
            is_water_ice_proximity_question(
                "Why is water ice important on the Moon?"
            )
        )

    def test_formats_backend_sites_evidence_confidence_and_sources(self):
        shackleton = {
            "name": "Shackleton Crater",
            "distance_km": 136.436,
            "latitude": -89.9,
            "longitude": 0.0,
            "ice_probability": (
                "candidate; remote-sensing hydrogen and radar evidence, "
                "no site-specific abundance"
            ),
            "description": (
                "The crater interior is a south-pole PSR. Published remote-sensing "
                "evidence supports an ice candidate designation, not a confirmed "
                "extractable deposit."
            ),
            "evidence_source": (
                "NASA NTRS: Integration of Lunar Polar Remote-Sensing Data Sets: "
                "Evidence for Ice at the Lunar South Pole (2003), "
                "[https://ntrs.nasa.gov/citations/20030007904]"
                "(https://ntrs.nasa.gov/citations/20030007904)"
            ),
        }
        cabeus = {
            "name": "Cabeus Crater",
            "distance_km": 163.213,
            "latitude": None,
            "longitude": None,
            "ice_probability": None,
            "description": None,
            "evidence_source": None,
        }
        data = {
            "nearest_water_ice_site": shackleton,
            "nearby_water_ice_sites": [shackleton, cabeus],
        }

        answer = format_water_ice_response(
            data, "Mons Mouton - MMO01", -85.416, 31.851
        )

        self.assertIn("Mons Mouton - MMO01 (-85.416, 31.851)", answer)
        self.assertIn("Shackleton Crater", answer)
        self.assertIn("136.436 km", answer)
        self.assertIn("Cabeus Crater: 163.213 km", answer)
        self.assertIn(
            "Ice evidence / confidence: candidate; remote-sensing hydrogen and "
            "radar evidence, no site-specific abundance",
            answer,
        )
        self.assertIn(
            "Scientific explanation: The crater interior is a south-pole PSR. "
            "Published remote-sensing evidence supports an ice candidate "
            "designation, not a confirmed extractable deposit.",
            answer,
        )
        self.assertIn(
            "[NASA NTRS: Integration of Lunar Polar Remote-Sensing Data Sets: "
            "Evidence for Ice at the Lunar South Pole (2003)]"
            "(https://ntrs.nasa.gov/citations/20030007904)",
            answer,
        )
        self.assertIn(
            "[1] NASA NTRS: Integration of Lunar Polar Remote-Sensing Data Sets: "
            "Evidence for Ice at the Lunar South Pole (2003) — "
            "https://ntrs.nasa.gov/citations/20030007904",
            answer,
        )
        self.assertIn("not a safe rover route", answer)
        self.assertIn("not confirmation", answer)

    def test_missing_backend_sites_does_not_invent_measurements(self):
        answer = format_water_ice_response(
            {"nearby_water_ice_sites": []},
            "Mons Mouton - MMO01",
            -85.416,
            31.851,
        )

        self.assertIn("No measurements have been substituted", answer)
        self.assertNotIn("Shackleton crater", answer)

    def test_fetch_uses_demo_coordinates_and_formats_actual_response(self):
        backend_data = {
            "nearby_sites": [
                {"name": "Shackleton crater", "distance_km": 136.436}
            ]
        }
        find_ice = Mock(return_value=backend_data)

        answer = fetch_water_ice_response(
            "Mons Mouton - MMO01", -85.416, 31.851, find_ice
        )

        find_ice.assert_called_once_with({
            "lat": -85.416,
            "lon": 31.851,
            "search_radius_km": 250,
        })
        self.assertIn("136.436 km", answer)


if __name__ == "__main__":
    unittest.main()
