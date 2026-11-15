import math
import unittest
from unittest.mock import Mock

from historical_mission_advisor import (
    MEAN_LUNAR_RADIUS_KM,
    fetch_nearby_historical_missions,
    format_nearby_historical_missions,
    haversine_distance_km,
    is_historical_mission_proximity_question,
    normalize_longitude,
)


class HistoricalMissionAdvisorTests(unittest.TestCase):
    def setUp(self):
        self.site_name = "Mons Mouton - MMO01"
        self.latitude = -85.416
        self.longitude = 31.851

    def _mission(self, name, latitude, longitude, outcome="successful landing"):
        return {
            "id": name.casefold().replace(" ", "-"),
            "name": name,
            "country": "Mock country",
            "landing_outcome": outcome,
            "marker_location": {
                "latitude_deg": latitude,
                "longitude_deg": longitude,
                "location_type": "mock landing marker",
                "coordinate_quality": "mock test coordinate",
            },
        }

    def test_detects_historical_mission_proximity_questions(self):
        for question in (
            "Which lunar missions landed closest to Mons Mouton?",
            "How far away are nearby rovers?",
            "What is the nearest lunar landing site?",
        ):
            with self.subTest(question=question):
                self.assertTrue(is_historical_mission_proximity_question(question))

    def test_does_not_match_general_lunar_question(self):
        self.assertFalse(
            is_historical_mission_proximity_question(
                "Why is the lunar south pole important?"
            )
        )
        self.assertFalse(
            is_historical_mission_proximity_question(
                "How far can a rover travel?"
            )
        )

    def test_haversine_distance_uses_mean_lunar_radius(self):
        expected = MEAN_LUNAR_RADIUS_KM * math.radians(1)
        distance = haversine_distance_km(0, 0, 1, 0)
        self.assertAlmostEqual(distance, expected, places=8)
        self.assertEqual(haversine_distance_km(0, 0, 0, 0), 0)

    def test_normalizes_east_positive_longitudes_and_wraparound(self):
        self.assertEqual(normalize_longitude(360), 0)
        self.assertEqual(normalize_longitude(181), -179)
        self.assertEqual(normalize_longitude(-181), 179)

        distance = haversine_distance_km(0, 359.9, 0, 0.1)
        expected = MEAN_LUNAR_RADIUS_KM * math.radians(0.2)
        self.assertAlmostEqual(distance, expected, places=8)

    def test_sorts_by_distance_and_shows_at_most_five(self):
        missions = [
            self._mission(f"Mock record {offset}", self.latitude, self.longitude + offset)
            for offset in (6, 3, 5, 1, 4, 2)
        ]

        answer = format_nearby_historical_missions(
            missions, self.site_name, self.latitude, self.longitude
        )

        self.assertLess(answer.index("Mock record 1"), answer.index("Mock record 2"))
        self.assertLess(answer.index("Mock record 2"), answer.index("Mock record 3"))
        self.assertLess(answer.index("Mock record 3"), answer.index("Mock record 4"))
        self.assertLess(answer.index("Mock record 4"), answer.index("Mock record 5"))
        self.assertNotIn("Mock record 6", answer)

    def test_formats_outcomes_and_marker_metadata_without_conflating_impact(self):
        missions = [
            self._mission("Mock success", self.latitude, self.longitude, "successful landing"),
            self._mission("Mock failure", self.latitude, self.longitude + 1, "failed landing"),
            self._mission("Mock impact", self.latitude, self.longitude + 2, "impact"),
        ]

        answer = format_nearby_historical_missions(
            missions, self.site_name, self.latitude, self.longitude
        )

        self.assertIn("Mock country", answer)
        self.assertIn("successful landing (Successful landing)", answer)
        self.assertIn("failed landing (Failed landing)", answer)
        self.assertIn("impact (Impact site; not a successful landing)", answer)
        self.assertIn("Location type: mock landing marker", answer)
        self.assertIn("Coordinate quality: mock test coordinate", answer)
        self.assertIn("not establish that a spacecraft or rover is currently operational", answer)
        self.assertIn("do not separately establish rover operations", answer)

    def test_skips_invalid_coordinates_and_handles_empty_results(self):
        invalid = self._mission("Mock invalid", None, "not a coordinate")
        answer = format_nearby_historical_missions(
            [invalid], self.site_name, self.latitude, self.longitude
        )
        self.assertIn("No records included valid marker coordinates", answer)

        empty_answer = format_nearby_historical_missions(
            [], self.site_name, self.latitude, self.longitude
        )
        self.assertIn("no historical mission records", empty_answer)

    def test_fetch_uses_mocked_backend_response(self):
        mission = self._mission("Mock nearest record", self.latitude, self.longitude)
        get_missions = Mock(return_value=[mission])

        answer = fetch_nearby_historical_missions(
            self.site_name,
            self.latitude,
            self.longitude,
            get_missions,
        )

        get_missions.assert_called_once_with()
        self.assertIn("Mock nearest record", answer)


if __name__ == "__main__":
    unittest.main()
