
from datetime import datetime, timedelta
from timeline_data import get_visibility
from site_catalog import SITES

STEP_MINUTES = 30
SEARCH_DAYS = 3


def find_time_window(mission):

    duration = mission.get("duration_hours")
    needs_sun = mission.get("needs_sunlight")
    needs_earth = mission.get("needs_communication")
    start_date = mission.get("preferred_date")

    # Validate mission inputs
    if duration is None or needs_sun is None or needs_earth is None:
        return {"status": "missing_requirements"}

    if isinstance(duration, bool) or not isinstance(duration, (int, float)):
        return {"status": "invalid_duration"}

    if duration <= 0:
        return {"status": "invalid_duration"}

    try:
        datetime.strptime(start_date, "%Y-%m-%d")
    except (ValueError, TypeError):
        return {"status": "invalid_date"}

    # Convert requested duration into 30-minute intervals
    total_minutes = duration * 60
    steps = round(total_minutes / STEP_MINUTES)

    if steps < 1 or abs(steps * STEP_MINUTES - total_minutes) > 0.001:
        return {"status": "unsupported_duration"}

    expected_gap = timedelta(minutes=STEP_MINUTES)

    matches = []
    checked_sites = []
    errors = []

    for site in SITES:

        print(f"\nChecking {site['name']}...")

        try:
            sun_data = get_visibility(
                "10", start_date,
                days=SEARCH_DAYS,
                latitude=site["latitude"],
                longitude=site["longitude"],
                step_minutes=STEP_MINUTES
            )

            earth_data = get_visibility(
                "399", start_date,
                days=SEARCH_DAYS,
                latitude=site["latitude"],
                longitude=site["longitude"],
                step_minutes=STEP_MINUTES
            )

            sun = {r["time"]: r for r in sun_data}
            earth = {r["time"]: r for r in earth_data}

            if not sun or set(sun) != set(earth):
                errors.append(site["name"])
                continue

            times = sorted(sun.keys())
            checked_sites.append(site["name"])

            for i in range(len(times) - steps):

                window = times[i:i + steps + 1]

                # Check timestamps are consecutive
                continuous = all(
                    window[j + 1] - window[j] == expected_gap
                    for j in range(steps)
                )

                if not continuous:
                    continue

                # Check Sun and Earth requirements
                suitable = all(
                    (not needs_sun or sun[t]["elevation"] > 0)
                    and
                    (not needs_earth or earth[t]["elevation"] > 0)
                    for t in window
                )

                if suitable:
                    matches.append({
                        "site": site["name"],
                        "latitude": site["latitude"],
                        "longitude": site["longitude"],
                        "start_time": window[0].isoformat(),
                        "end_time": window[-1].isoformat()
                    })

                    # First matching window at this site
                    break

        except Exception as error:
            print(f"Data error at {site['name']}: {error}")
            errors.append(site["name"])

    # Put the earliest available window first
    matches.sort(key=lambda x: x["start_time"])

    if matches:
        return {
            "status": "window_found",
            "recommended": matches[0],
            "alternatives": matches[1:],
            "checked_sites": checked_sites,
            "failed_sites": errors,
            "source": "NASA JPL Horizons",
            "method": "30-minute smooth-horizon estimate"
        }

    if not checked_sites:
        return {
            "status": "data_error",
            "message": "Could not evaluate candidate sites.",
            "failed_sites": errors
        }

    return {
        "status": "no_window",
        "message": "No matching window at successfully checked sites.",
        "checked_sites": checked_sites,
        "failed_sites": errors
    }
