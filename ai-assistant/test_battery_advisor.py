import unittest

from battery_advisor import (
    calculate_battery_capacity,
    calculate_battery_endurance,
    is_battery_question,
    answer_battery_question,
)


class BatteryAdvisorTests(unittest.TestCase):
    def test_ideal_energy_for_200_watts_over_10_hours(self):
        result = calculate_battery_capacity(200, 10)
        self.assertAlmostEqual(result["ideal_energy_kwh"], 2.0)

    def test_nominal_capacity_uses_disclosed_assumptions_and_margin(self):
        result = calculate_battery_capacity(
            200, 10, dod=0.8, efficiency=0.9, sizing_margin=0.2
        )
        self.assertAlmostEqual(result["nominal_capacity_kwh"], 3.3333333333)

    def test_known_capacity_endurance_does_not_apply_sizing_margin(self):
        endurance = calculate_battery_endurance(200, 5, dod=0.8, efficiency=0.9)
        self.assertAlmostEqual(endurance, 18.0)

        answer = answer_battery_question(
            "How long can a 200 W rover operate with a 5 kWh battery?"
        )
        self.assertIn("Estimated endurance: 18.00 h", answer)
        self.assertIn("20% (not applied to endurance)", answer)

    def test_question_detection_and_general_science_exclusion(self):
        self.assertTrue(is_battery_question(
            "My rover consumes 200 watts. What battery capacity is required for 10 hours?"
        ))
        self.assertTrue(is_battery_question(
            "How long can a 200 W rover operate with a 5 kWh battery?"
        ))
        self.assertFalse(is_battery_question(
            "Why do lunar rovers need batteries?"
        ))

    def test_capacity_answer_formats_ideal_and_nominal_energy(self):
        answer = answer_battery_question(
            "My rover consumes 200 watts. What battery capacity is required "
            "for 10 hours without sunlight?"
        )
        self.assertIn("Ideal energy demand: 2.000 kWh", answer)
        self.assertIn("Nominal battery capacity: 3.333 kWh nominal", answer)
        self.assertIn("Usable depth of discharge: 80%", answer)
        self.assertIn("Electrical efficiency: 90%", answer)
        self.assertIn("Engineering sizing margin: 20%", answer)
        self.assertIn("not a flight-qualified recommendation", answer)
        self.assertIn("temperature, heaters, discharge rates, solar charging", answer)

    def test_explicit_assumption_overrides_are_used(self):
        answer = answer_battery_question(
            "Size a battery for a 200 W load for 10 hours with DoD 70%, "
            "electrical efficiency 85%, and sizing margin 25%."
        )
        expected = 2 / (0.70 * 0.85) * 1.25
        self.assertIn(f"Nominal battery capacity: {expected:.3f} kWh", answer)
        self.assertIn("Usable depth of discharge: 70%", answer)
        self.assertIn("Electrical efficiency: 85%", answer)
        self.assertIn("Engineering sizing margin: 25%", answer)

    def test_missing_inputs_are_requested_and_ah_requires_voltage(self):
        missing = answer_battery_question("What battery capacity does my rover need?")
        self.assertIn("rover power", missing)
        self.assertIn("operating duration", missing)

        missing_voltage = answer_battery_question(
            "How long can a 200 W rover operate with a 500 Ah battery?"
        )
        self.assertIn("battery voltage", missing_voltage)

        ah_capacity = answer_battery_question(
            "What battery capacity in Ah is required for 200 W over 10 hours?"
        )
        self.assertIn("battery voltage", ah_capacity)

    def test_ah_conversion_uses_explicit_voltage(self):
        answer = answer_battery_question(
            "How long can a 200 W rover operate with a 500 Ah battery at 48 V?"
        )
        self.assertIn("500 Ah at 48 V (24 kWh equivalent)", answer)
        self.assertIn("Estimated endurance: 86.40 h", answer)

        required_ah = answer_battery_question(
            "What battery capacity in Ah is required for 200 W over 10 hours at 48 V?"
        )
        self.assertIn("at 48 V", required_ah)
        self.assertIn("Ideal energy demand: 2.000 kWh", required_ah)

    def test_invalid_inputs_are_reported_without_calculating(self):
        with self.assertRaises(ValueError):
            calculate_battery_capacity(0, 10)
        with self.assertRaises(ValueError):
            calculate_battery_endurance(200, float("inf"))

        answer = answer_battery_question(
            "What battery capacity is required for a 0 W rover for 10 hours?"
        )
        self.assertIn("Power must be greater than 0", answer)

        invalid_override = answer_battery_question(
            "What battery capacity is required for 200 W for 10 hours with "
            "efficiency 150%?"
        )
        self.assertIn("Electrical efficiency must be", invalid_override)


if __name__ == "__main__":
    unittest.main()
