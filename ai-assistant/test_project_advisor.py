import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from project_advisor import (
    PROJECT_MODEL,
    answer_project_question,
    is_project_question,
    load_project_knowledge,
)


class ProjectAdvisorTests(unittest.TestCase):
    def test_detects_project_questions_without_grabbing_general_science(self):
        for question in (
            "What is Lunar Compass?",
            "Does our project calculate crash probabilities?",
            "What does the Three.js frontend do for Lunar Compass?",
            "Does our terrain analysis calculate landing risk?",
        ):
            with self.subTest(question=question):
                self.assertTrue(is_project_question(question))

        self.assertFalse(is_project_question("Why is the lunar south pole useful?"))
        self.assertFalse(is_project_question("What is NASA JPL Horizons?"))

    def test_local_knowledge_contains_supported_and_unsupported_facts(self):
        knowledge = " ".join(load_project_knowledge().casefold().split())
        for supported_fact in (
            "three.js",
            "fastapi",
            "nasa jpl horizons",
            "lola site01",
            "historical mission",
            "stress-test",
            "mission-windows",
            "groq",
            "streamlit",
            "clear chat",
            "chat history",
        ):
            with self.subTest(fact=supported_fact):
                self.assertIn(supported_fact, knowledge)

        for unsupported_feature in (
            "active satellite tracking",
            "link-budget design",
            "radiation forecasting",
            "terrain-safe rover routing",
            "crash-probability calculation",
        ):
            with self.subTest(feature=unsupported_feature):
                self.assertIn(unsupported_feature, knowledge)

    def test_groq_receives_local_knowledge_and_unsupported_limits(self):
        response = SimpleNamespace(
            choices=[SimpleNamespace(
                message=SimpleNamespace(
                    content="No. The project does not calculate crash probabilities."
                )
            )]
        )
        client = Mock()
        client.chat.completions.create.return_value = response

        answer = answer_project_question(
            "Does Lunar Compass calculate crash probabilities?", client
        )

        self.assertIn("does not calculate crash probabilities", answer)
        call = client.chat.completions.create.call_args.kwargs
        self.assertEqual(call["model"], PROJECT_MODEL)
        self.assertIn("only from the supplied project knowledge", call["messages"][0]["content"])
        context = " ".join(call["messages"][1]["content"].casefold().split())
        self.assertIn("nasa jpl horizons", context)
        self.assertIn("active satellite tracking", context)

    def test_common_overview_questions_return_deterministic_complete_response(self):
        client = Mock()
        questions = (
            "What is Lunar Compass?",
            "What is Lunar Compass and how does it work?",
            "Explain our Lunar Compass project.",
        )

        for question in questions:
            with self.subTest(question=question):
                answer = answer_project_question(question, client)
                words = answer.split()
                self.assertGreaterEqual(len(words), 180)
                self.assertLessEqual(len(words), 250)
                self.assertNotIn("<br", answer.casefold())
                self.assertNotIn("|", answer)
                self.assertIn("## Three.js Frontend", answer)
                self.assertIn("## FastAPI Backend", answer)
                self.assertIn("## Groq-powered Streamlit AI Assistant", answer)
                self.assertIn("embedding it in the main Three.js interface is planned", answer)
                self.assertIn("does not certify landing safety", answer)

        client.chat.completions.create.assert_not_called()

    def test_detailed_project_question_still_uses_groq_knowledge_path(self):
        response = SimpleNamespace(
            choices=[SimpleNamespace(
                message=SimpleNamespace(content="Site01 terrain data cover a limited area."),
                finish_reason="stop",
            )]
        )
        client = Mock()
        client.chat.completions.create.return_value = response

        answer = answer_project_question(
            "What are the limitations of LOLA Site01 terrain data in Lunar Compass?",
            client,
        )

        self.assertIn("limited area", answer)
        client.chat.completions.create.assert_called_once()
        context = client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
        self.assertIn("Site01", context)

    def test_truncated_answer_retries_once_and_returns_only_complete_retry(self):
        truncated = SimpleNamespace(
            choices=[SimpleNamespace(
                message=SimpleNamespace(content="Partial answer without its ending"),
                finish_reason="length",
            )]
        )
        complete_text = (
            "## Overview\n\n"
            "Lunar Compass combines a Three.js site-selection frontend, a FastAPI "
            "analysis backend, and a separate Groq-powered Streamlit chatbot. "
            "The backend reports modeled visibility and available terrain data; "
            "these do not establish landing safety."
        )
        complete = SimpleNamespace(
            choices=[SimpleNamespace(
                message=SimpleNamespace(content=complete_text),
                finish_reason="stop",
            )]
        )
        client = Mock()
        client.chat.completions.create.side_effect = [truncated, complete]

        answer = answer_project_question("What does the LOLA terrain module do in Lunar Compass?", client)

        self.assertEqual(client.chat.completions.create.call_count, 2)
        self.assertEqual(answer, complete_text)
        self.assertNotIn("Partial answer", answer)

    def test_repeated_truncation_returns_complete_retry_message(self):
        truncated = SimpleNamespace(
            choices=[SimpleNamespace(
                message=SimpleNamespace(content="Still incomplete"),
                finish_reason="length",
            )]
        )
        client = Mock()
        client.chat.completions.create.side_effect = [truncated, truncated]

        answer = answer_project_question("What does the LOLA terrain module do in Lunar Compass?", client)

        self.assertEqual(client.chat.completions.create.call_count, 2)
        self.assertEqual(answer, "I couldn't complete a concise, source-grounded Lunar Compass explanation this time. Please retry your question.")
        self.assertNotIn("Still incomplete", answer)

    def test_portal_routes_project_questions_before_general_rag(self):
        portal_source = Path(__file__).with_name("portal.py").read_text(encoding="utf-8")
        project_route = portal_source.index('if route == "project":')
        project_answer = portal_source.index("answer_project_question(prompt, client)")
        self.assertLess(project_route, project_answer)


if __name__ == "__main__":
    unittest.main()
