"""Pure-Python battery sizing and endurance estimates from explicit inputs."""

import math
import re


DEFAULT_DOD = 0.80
DEFAULT_EFFICIENCY = 0.90
DEFAULT_SIZING_MARGIN = 0.20

_NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)"
_POWER_RE = re.compile(
    rf"(?P<value>{_NUMBER})\s*(?P<unit>kW|kilowatts?|W|watts?)\b", re.I
)
_DURATION_RE = re.compile(
    rf"(?P<value>{_NUMBER})\s*(?P<unit>hours?|hrs?|h|minutes?|mins?)\b", re.I
)
_BATTERY_RE = re.compile(
    rf"(?P<value>{_NUMBER})\s*(?P<unit>kWh|Wh|Ah|amp(?:ere)?[- ]hours?)\b", re.I
)
_AMP_HOUR_UNITS = {
    "ah", "amp-hour", "amp-hours", "ampere-hour", "ampere-hours"
}
_VOLTAGE_RE = re.compile(rf"(?P<value>{_NUMBER})\s*(?:V|volts?)\b", re.I)
_DOD_RE = re.compile(
    rf"(?:depth\s+of\s+discharge|dod)\s*(?:is|of|=|:)?\s*(?P<value>{_NUMBER})\s*%|"
    rf"(?P<after>{_NUMBER})\s*%\s*(?:usable\s+)?(?:depth\s+of\s+discharge|dod)\b",
    re.I,
)
_EFFICIENCY_RE = re.compile(
    rf"(?:electrical\s+)?efficiency\s*(?:is|=|:)?\s*(?P<value>{_NUMBER})\s*%",
    re.I,
)
_MARGIN_RE = re.compile(
    rf"(?:engineering\s+)?(?:sizing\s+)?margin\s*(?:is|=|:)?\s*(?P<value>{_NUMBER})\s*%",
    re.I,
)
_BATTERY_TERMS = re.compile(r"\b(?:battery|batteries|endurance)\b", re.I)
_CALCULATION_TERMS = re.compile(
    r"\b(?:capacity|size|how big|what size|sizing|endurance|how long|"
    r"operate|operating|run for|last for|required|needed|need)\b",
    re.I,
)
_WHY_QUESTION = re.compile(r"^\s*(?:why|what is the purpose of)\b", re.I)
_ENDURANCE_QUESTION = re.compile(
    r"\b(?:how long|endurance|operate|operating|run for|last for)\b", re.I
)
_CAPACITY_QUESTION = re.compile(
    r"\b(?:capacity|size|how big|what size|sizing|required|needed|need)\b", re.I
)
_OUTPUT_AH = re.compile(
    r"\b(?:in\s+|\(\s*)(?:Ah|amp[- ]hours?)\b|"
    r"\b(?:Ah|amp[- ]hours?)\s+(?:capacity|battery size)\b|"
    r"\bhow many\s+(?:Ah|amp[- ]hours?)\b",
    re.I,
)


def _finite_number(value, label):
    if isinstance(value, bool):
        raise ValueError(f"{label} must be a number.")
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a number.") from exc
    if not math.isfinite(number):
        raise ValueError(f"{label} must be finite.")
    return number


def _validate_fraction(value, label, allow_zero=False):
    number = _finite_number(value, label)
    lower_ok = number >= 0 if allow_zero else number > 0
    if not lower_ok or number > 1:
        lower = "0" if allow_zero else "greater than 0"
        raise ValueError(f"{label} must be {lower} and no more than 100%.")
    return number


def calculate_battery_capacity(
    power_w,
    duration_hours,
    dod=DEFAULT_DOD,
    efficiency=DEFAULT_EFFICIENCY,
    sizing_margin=DEFAULT_SIZING_MARGIN,
):
    """Return ideal energy and nominal capacity in kWh."""
    power_w = _finite_number(power_w, "Power")
    duration_hours = _finite_number(duration_hours, "Duration")
    _validate_power(power_w)
    _validate_duration(duration_hours)

    dod = _validate_fraction(dod, "Usable depth of discharge")
    efficiency = _validate_fraction(efficiency, "Electrical efficiency")
    sizing_margin = _validate_fraction(
        sizing_margin, "Engineering sizing margin", allow_zero=True
    )

    ideal_energy_kwh = power_w * duration_hours / 1000
    nominal_capacity_kwh = (
        ideal_energy_kwh / (dod * efficiency) * (1 + sizing_margin)
    )
    return {
        "ideal_energy_kwh": ideal_energy_kwh,
        "nominal_capacity_kwh": nominal_capacity_kwh,
    }


def calculate_battery_endurance(
    power_w,
    battery_capacity_kwh,
    dod=DEFAULT_DOD,
    efficiency=DEFAULT_EFFICIENCY,
):
    """Return estimated hours; sizing margin is not applied to endurance."""
    power_w = _finite_number(power_w, "Power")
    battery_capacity_kwh = _finite_number(battery_capacity_kwh, "Battery capacity")
    _validate_power(power_w)
    if not 0 < battery_capacity_kwh <= 1_000_000:
        raise ValueError(
            "Battery capacity must be greater than 0 and no more than 1,000,000 kWh."
        )

    dod = _validate_fraction(dod, "Usable depth of discharge")
    efficiency = _validate_fraction(efficiency, "Electrical efficiency")
    return battery_capacity_kwh * 1000 * dod * efficiency / power_w


def _validate_power(power_w):
    if not 0 < power_w <= 1_000_000:
        raise ValueError("Power must be greater than 0 and no more than 1,000,000 W.")


def _validate_duration(duration_hours):
    if not 0 < duration_hours <= 8760:
        raise ValueError("Duration must be greater than 0 and no more than 8,760 hours.")


def is_battery_question(question):
    """Match battery sizing or endurance requests, not general science questions."""
    if _WHY_QUESTION.search(question):
        return False
    return bool(
        _BATTERY_TERMS.search(question)
        and _CALCULATION_TERMS.search(question)
    )


def _extract_percent(pattern, question, default):
    match = pattern.search(question)
    if not match:
        return default
    value = match.groupdict().get("value") or match.groupdict().get("after")
    return float(value) / 100


def _parse_inputs(question):
    power_match = _POWER_RE.search(question)
    power_w = None
    if power_match:
        power_w = float(power_match.group("value"))
        if power_match.group("unit").lower().startswith("k"):
            power_w *= 1000

    duration_match = _DURATION_RE.search(question)
    duration_hours = None
    if duration_match:
        duration_hours = float(duration_match.group("value"))
        if duration_match.group("unit").lower().startswith("min"):
            duration_hours /= 60

    battery_match = _BATTERY_RE.search(question)
    battery_capacity_kwh = None
    battery_unit = None
    battery_value = None
    if battery_match:
        battery_value = float(battery_match.group("value"))
        battery_unit = battery_match.group("unit").lower().replace(" ", "-")
        if battery_unit == "kwh":
            battery_capacity_kwh = battery_value
        elif battery_unit == "wh":
            battery_capacity_kwh = battery_value / 1000

    voltage_match = _VOLTAGE_RE.search(question)
    voltage_v = float(voltage_match.group("value")) if voltage_match else None
    if battery_match and battery_unit in _AMP_HOUR_UNITS and voltage_v is not None:
        battery_capacity_kwh = battery_value * voltage_v / 1000

    return {
        "power_w": power_w,
        "duration_hours": duration_hours,
        "battery_capacity_kwh": battery_capacity_kwh,
        "battery_unit": battery_unit,
        "battery_value": battery_value,
        "voltage_v": voltage_v,
        "dod": _extract_percent(_DOD_RE, question, DEFAULT_DOD),
        "efficiency": _extract_percent(_EFFICIENCY_RE, question, DEFAULT_EFFICIENCY),
        "sizing_margin": _extract_percent(_MARGIN_RE, question, DEFAULT_SIZING_MARGIN),
        "output_ah": bool(_OUTPUT_AH.search(question)),
    }


def _assumptions_text(inputs, include_margin=True):
    lines = [
        f"- Usable depth of discharge: {inputs['dod'] * 100:g}%",
        f"- Electrical efficiency: {inputs['efficiency'] * 100:g}%",
    ]
    if include_margin:
        lines.append(f"- Engineering sizing margin: {inputs['sizing_margin'] * 100:g}%")
    return "\n".join(lines)


def answer_battery_question(question):
    """Parse explicit battery inputs and return a deterministic estimate or prompt."""
    inputs = _parse_inputs(question)
    try:
        _validate_fraction(inputs["dod"], "Usable depth of discharge")
        _validate_fraction(inputs["efficiency"], "Electrical efficiency")
        _validate_fraction(
            inputs["sizing_margin"], "Engineering sizing margin", allow_zero=True
        )
        if inputs["power_w"] is not None:
            _validate_power(inputs["power_w"])
        if inputs["duration_hours"] is not None:
            _validate_duration(inputs["duration_hours"])
        if inputs["battery_value"] is not None:
            battery_value = _finite_number(
                inputs["battery_value"], "Battery capacity"
            )
            if not 0 < battery_value <= 1_000_000_000:
                raise ValueError(
                    "Battery capacity must be positive and within a sensible range."
                )
        if inputs["battery_capacity_kwh"] is not None:
            capacity = _finite_number(
                inputs["battery_capacity_kwh"], "Battery capacity"
            )
            if not 0 < capacity <= 1_000_000:
                raise ValueError(
                    "Battery capacity must be greater than 0 and no more than 1,000,000 kWh."
                )
        if inputs["voltage_v"] is not None:
            _validate_voltage(inputs["voltage_v"])
    except ValueError as error:
        return _invalid_inputs_response(str(error), inputs)

    endurance_question = bool(_ENDURANCE_QUESTION.search(question))
    capacity_question = bool(_CAPACITY_QUESTION.search(question))
    if endurance_question and inputs["battery_capacity_kwh"] is not None:
        mode = "endurance"
    elif capacity_question or inputs["output_ah"]:
        mode = "capacity"
    elif endurance_question:
        mode = "endurance"
    else:
        mode = "unknown"

    if mode == "unknown":
        return (
            "Please ask for either a required battery capacity (with rover power "
            "and operating duration) or estimated endurance (with rover power "
            "and battery capacity)."
        )

    errors = []
    if inputs["power_w"] is None:
        errors.append("rover power, such as 200 W")
    if mode == "capacity" and inputs["duration_hours"] is None:
        errors.append("operating duration, such as 10 hours")
    if mode == "endurance" and inputs["battery_capacity_kwh"] is None:
        if inputs["battery_unit"] in _AMP_HOUR_UNITS and inputs["voltage_v"] is None:
            errors.append("battery voltage, such as 48 V, to convert Ah to energy")
        else:
            errors.append("battery capacity, such as 5 kWh")
    if mode == "capacity" and inputs["output_ah"] and inputs["voltage_v"] is None:
        errors.append("battery voltage, such as 48 V, to express capacity in Ah")

    if errors:
        return _missing_inputs_response(errors, inputs, mode)

    try:
        if mode == "capacity":
            result = calculate_battery_capacity(
                inputs["power_w"],
                inputs["duration_hours"],
                inputs["dod"],
                inputs["efficiency"],
                inputs["sizing_margin"],
            )
            if inputs["output_ah"]:
                voltage = _validate_voltage(inputs["voltage_v"])
                result["nominal_capacity_ah"] = (
                    result["nominal_capacity_kwh"] * 1000 / voltage
                )
            return _format_capacity_answer(inputs, result)

        if inputs["battery_unit"] in _AMP_HOUR_UNITS and inputs["voltage_v"] is None:
            return _missing_inputs_response(
                ["battery voltage, such as 48 V, to convert Ah to energy"],
                inputs,
                mode,
            )
        if inputs["battery_unit"] in _AMP_HOUR_UNITS:
            _validate_voltage(inputs["voltage_v"])
        endurance_hours = calculate_battery_endurance(
            inputs["power_w"],
            inputs["battery_capacity_kwh"],
            inputs["dod"],
            inputs["efficiency"],
        )
        return _format_endurance_answer(inputs, endurance_hours)
    except ValueError as error:
        return _invalid_inputs_response(str(error), inputs)


def _validate_voltage(value):
    voltage = _finite_number(value, "Battery voltage")
    if not 1 <= voltage <= 2000:
        raise ValueError("Battery voltage must be between 1 V and 2,000 V.")
    return voltage


def _missing_inputs_response(missing, inputs, mode):
    requested = "\n".join(f"- {item}" for item in missing)
    assumptions = _assumptions_text(inputs, include_margin=True)
    if mode == "endurance":
        assumptions += "\n- Sizing margin is not applied to endurance."
    return (
        "I need these explicit inputs before I can calculate a battery estimate:\n"
        f"{requested}\n\n"
        "Illustrative assumptions (defaults apply unless you override them):\n"
        f"{assumptions}\n\n"
        "For example: `DoD 70%, efficiency 85%` and, for capacity sizing, "
        "`sizing margin 25%`. If you request Ah, include battery voltage."
    )


def _invalid_inputs_response(error, inputs):
    return (
        f"I couldn't calculate this estimate: {error}\n\n"
        "Use positive finite power and duration/capacity values, DoD and "
        "efficiency from 1% to 100%, and sizing margin from 0% to 100%.\n\n"
        "Assumptions in this request:\n"
        f"{_assumptions_text(inputs)}"
    )


def _format_capacity_answer(inputs, result):
    if "nominal_capacity_ah" in result:
        capacity = f"{result['nominal_capacity_ah']:.2f} Ah at {inputs['voltage_v']:g} V"
    else:
        capacity = f"{result['nominal_capacity_kwh']:.3f} kWh nominal"
    return (
        "### Battery capacity estimate\n\n"
        f"- Rover power: {inputs['power_w']:g} W\n"
        f"- Operating duration: {inputs['duration_hours']:g} h\n"
        f"- Ideal energy demand: {result['ideal_energy_kwh']:.3f} kWh\n"
        f"- Nominal battery capacity: {capacity}\n\n"
        "Illustrative assumptions used:\n"
        f"{_assumptions_text(inputs)}\n\n"
        f"The {inputs['sizing_margin'] * 100:g}% sizing margin is applied once "
        "to nominal capacity sizing. "
        "The stated power is treated as a continuous average load. This is an "
        "estimate, not a flight-qualified recommendation. Real sizing also "
        "depends on temperature, heaters, discharge rates, solar charging, and "
        "other mission loads."
    )


def _format_endurance_answer(inputs, endurance_hours):
    if inputs["battery_unit"] in _AMP_HOUR_UNITS:
        battery_capacity = (
            f"{inputs['battery_value']:g} Ah at {inputs['voltage_v']:g} V "
            f"({inputs['battery_capacity_kwh']:g} kWh equivalent)"
        )
    else:
        battery_capacity = f"{inputs['battery_capacity_kwh']:g} kWh nominal"
    return (
        "### Battery endurance estimate\n\n"
        f"- Rover power: {inputs['power_w']:g} W\n"
        f"- Battery capacity: {battery_capacity}\n"
        f"- Estimated endurance: {endurance_hours:.2f} h\n\n"
        "Usable-capacity assumptions used:\n"
        f"{_assumptions_text(inputs, include_margin=False)}\n"
        f"- Engineering sizing margin: {inputs['sizing_margin'] * 100:g}% "
        "(not applied to endurance)\n\n"
        "The engineering sizing margin is not applied again to ordinary "
        "endurance. The stated power is treated as a continuous average load. "
        "This is an estimate, not a flight-qualified recommendation. Real "
        "endurance also depends on temperature, heaters, discharge rates, "
        "solar charging, and other mission loads."
    )
