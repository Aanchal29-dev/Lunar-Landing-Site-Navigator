import unittest

from mission_followup import merge_mission_updates


class MergeMissionUpdatesTests(unittest.TestCase):
    def setUp(self):
        self.previous_mission = {
            "objective": "lunar exploration",
            "duration_hours": 4,
            "needs_sunlight": True,
            "needs_communication": True,
            "region": "south pole",
            "preferred_date": "2027-01-15"
        }

    def test_updates_duration(self):
        updates = {
            "is_followup": True,
            "duration_hours": 8
        }

        merged = merge_mission_updates(self.previous_mission, updates)

        self.assertEqual(merged["duration_hours"], 8)
        self.assertEqual(merged["objective"], "lunar exploration")

    def test_explicitly_disables_communication(self):
        updates = {
            "is_followup": True,
            "needs_communication": False
        }

        merged = merge_mission_updates(self.previous_mission, updates)

        self.assertIs(merged["needs_communication"], False)

    def test_updates_objective(self):
        updates = {
            "is_followup": True,
            "objective": "collecting rock samples"
        }

        merged = merge_mission_updates(self.previous_mission, updates)

        self.assertEqual(merged["objective"], "collecting rock samples")

    def test_preserves_unchanged_fields_and_original_dictionary(self):
        updates = {
            "is_followup": True,
            "duration_hours": 8,
            "objective": None,
            "needs_sunlight": None,
            "needs_communication": None,
            "region": None,
            "preferred_date": None
        }
        original = self.previous_mission.copy()

        merged = merge_mission_updates(self.previous_mission, updates)

        self.assertEqual(merged["duration_hours"], 8)
        for field in (
            "objective",
            "needs_sunlight",
            "needs_communication",
            "region",
            "preferred_date"
        ):
            self.assertEqual(merged[field], original[field])
        self.assertEqual(self.previous_mission, original)
        self.assertIsNot(merged, self.previous_mission)

    def test_rejects_non_followup(self):
        with self.assertRaises(ValueError):
            merge_mission_updates(
                self.previous_mission,
                {"is_followup": False, "duration_hours": 8}
            )


if __name__ == "__main__":
    unittest.main()
