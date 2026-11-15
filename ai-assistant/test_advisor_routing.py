import unittest
from pathlib import Path
from unittest.mock import Mock

from advisor_routing import select_advisor_route
from project_advisor import PROJECT_OVERVIEW, answer_project_question


class AdvisorRoutingTests(unittest.TestCase):
    def test_requested_specialized_and_general_routes(self):
        cases = (
            (
                "What is Lunar Compass and how does it work?",
                "project",
            ),
            (
                "In Lunar Compass, what is the nearest water-ice location "
                "to Mons Mouton?",
                "water_ice",
            ),
            (
                "In Lunar Compass, which lunar missions landed closest to Mons Mouton?",
                "historical_mission",
            ),
            (
                "Using Lunar Compass, how much sunlight is available at Mons Mouton?",
                "visibility",
            ),
            (
                "For Lunar Compass, my rover consumes 200 W. What battery is "
                "needed for 10 hours?",
                "battery",
            ),
            (
                "Schedule an 8-hour lunar mission requiring sunlight and "
                "communication in Lunar Compass.",
                "schedule",
            ),
            (
                "Why is sunlight important on the Moon?",
                "nasa_rag",
            ),
        )

        for question, expected_route in cases:
            with self.subTest(question=question):
                route = select_advisor_route(
                    question,
                    classified_intent=(
                        "moon_nasa" if expected_route == "nasa_rag" else None
                    ),
                )
                self.assertEqual(route, expected_route)

    def test_saved_mission_followups_keep_scheduler_priority(self):
        for question in (
            "Change the duration to 8 hours, but keep everything else the same.",
            "I no longer need Earth communication.",
            "In Lunar Compass, change the mission date to 2027-01-20.",
        ):
            with self.subTest(question=question):
                self.assertEqual(
                    select_advisor_route(question, has_saved_mission=True),
                    "schedule",
                )

    def test_project_context_does_not_override_specialized_or_schedule_intent(self):
        self.assertEqual(
            select_advisor_route(
                "Lunar Compass: what is the closest water ice site?"
            ),
            "water_ice",
        )
        self.assertEqual(
            select_advisor_route(
                "For Lunar Compass, schedule a 4-hour mission."
            ),
            "schedule",
        )
        self.assertEqual(
            select_advisor_route(
                "Compare the candidate locations in Lunar Compass for a mission."
            ),
            "schedule",
        )

    def test_portal_uses_router_before_advisor_branches_and_fallback_classifier(self):
        source = Path(__file__).with_name("portal.py").read_text(encoding="utf-8")
        select_route = source.index("route = select_advisor_route(")
        fallback = source.index("if route is None:")
        classify_fallback = source.index("intent = detect_intent(prompt)")
        project_branch = source.index('if route == "project":')
        self.assertLess(select_route, classify_fallback)
        self.assertLess(select_route, fallback)
        self.assertLess(fallback, classify_fallback)
        self.assertLess(classify_fallback, project_branch)

    def test_overview_question_routes_to_deterministic_response_without_groq(self):
        question = "What is Lunar Compass and how does it work?"
        client = Mock()

        route = select_advisor_route(question)
        self.assertEqual(route, "project")

        # Match portal.py's project branch: it sends this route to the imported
        # project_advisor.answer_project_question function.
        source = Path(__file__).with_name("portal.py").read_text(encoding="utf-8")
        self.assertIn("from project_advisor import (\n    answer_project_question,", source)
        self.assertIn("reply = answer_project_question(prompt, client)", source)
        reply = answer_project_question(question, client)

        self.assertEqual(reply, PROJECT_OVERVIEW)
        self.assertEqual(len(reply.split()), 194)
        client.chat.completions.create.assert_not_called()


if __name__ == "__main__":
    unittest.main()
