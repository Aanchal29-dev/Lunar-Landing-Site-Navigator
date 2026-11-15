import unittest
from unittest.mock import Mock

from navigator_client import NavigatorTimeoutError
from visibility_advisor import (
    DEMO_DURATION_HOURS,
    DEMO_START_UTC,
    fetch_visibility_response,
    format_visibility_response,
    is_visibility_question,
)


class VisibilityAdvisorTests(unittest.TestCase):
    def setUp(self):
        self.site_name = "Mons Mouton - MMO01"
        self.latitude = -85.416
        self.longitude = 31.851
        self.response = {
            "duration_hours": 24,
            "sampling_minutes": 60,
            "metrics": {
                "sunlight_percent": 100.0,
                "earth_visibility_percent": 100.0,
                "longest_darkness_hours": 0,
                "longest_earth_gap_hours": 0,
            },
            "timeline": [
                {"sun_visible": True, "earth_visible": True}
                for _ in range(24)
            ],
            "model": {
                "source": "NASA JPL Horizons",
                "sampling_method": "hourly_midpoints",
                "horizon_degrees": 0,
                "terrain_obstruction_included": False,
            },
        }

    def test_matches_location_specific_visibility_and_endurance_questions(self):
        for question in (
            "How many sunlight hours does Mons Mouton get?",
            "How long is Earth visible at this site?",
            "What are the direct Earth communication gaps at Mons Mouton?",
            "When is direct-to-Earth visibility available at the lunar surface?",
            "Can a rover stay at Mons Mouton for 24 hours?",
        ):
            with self.subTest(question=question):
                self.assertTrue(is_visibility_question(question))

    def test_does_not_match_general_science_question(self):
        self.assertFalse(
            is_visibility_question("Why is sunlight important on the Moon?")
        )

    def test_formats_backend_metrics_sampling_and_limits(self):
        answer = format_visibility_response(
            self.response,
            self.site_name,
            self.latitude,
            self.longitude,
            "How much sunlight does Mons Mouton get?",
        )

        self.assertIn("Mons Mouton - MMO01 (-85.416, 31.851)", answer)
        self.assertIn("2026-11-17T00:00:00Z to 2026-11-18T00:00:00Z", answer)
        self.assertIn("Sunlight visibility:** 100.0%", answer)
        self.assertIn("24 of 24 valid samples (approximately 24 hours)", answer)
        self.assertIn("Earth visibility:** 100.0%", answer)
        self.assertIn("Longest darkness interval:** 0 hours", answer)
        self.assertIn("Longest Earth-visibility gap:** 0 hours", answer)
        self.assertIn("NASA JPL Horizons", answer)
        self.assertIn("hourly midpoint sampling", answer)
        self.assertIn("simplified zero-degree geometric horizon", answer)
        self.assertIn("does not include local terrain shadows", answer)
        self.assertIn("does not establish connectivity to an active NASA or ISRO", answer)
        self.assertIn("does not establish that a rover can remain operational", answer)

    def test_total_stay_question_is_limited_to_evaluated_window(self):
        answer = format_visibility_response(
            self.response,
            self.site_name,
            self.latitude,
            self.longitude,
            "What total stay duration can a rover sustain at Mons Mouton?",
        )

        self.assertIn("evaluates only the 24-hour observation window", answer)
        self.assertIn("does not determine total rover stay duration or endurance", answer)

    def test_missing_data_is_reported_without_substituting_values(self):
        answer = format_visibility_response(
            {"metrics": {}, "timeline": []},
            self.site_name,
            self.latitude,
            self.longitude,
        )

        self.assertIn("Not provided by the backend", answer)
        self.assertIn("Not available; the response contained no valid Sun visibility samples", answer)
        self.assertIn("Not available; the response contained no valid Earth visibility samples", answer)

    def test_fetch_uses_fixed_window_and_passes_through_backend_error(self):
        analyze_visibility = Mock(return_value=self.response)

        answer = fetch_visibility_response(
            self.site_name,
            self.latitude,
            self.longitude,
            analyze_visibility,
        )

        analyze_visibility.assert_called_once_with({
            "latitude_deg": self.latitude,
            "longitude_deg": self.longitude,
            "start_utc": DEMO_START_UTC,
            "duration_hours": DEMO_DURATION_HOURS,
        })
        self.assertIn("100.0%", answer)

        analyze_visibility.side_effect = NavigatorTimeoutError("test timeout")
        with self.assertRaises(NavigatorTimeoutError):
            fetch_visibility_response(
                self.site_name,
                self.latitude,
                self.longitude,
                analyze_visibility,
            )


if __name__ == "__main__":
    unittest.main()
