
import requests
import csv
from datetime import datetime, timedelta, timezone

URL = "https://ssd.jpl.nasa.gov/api/horizons.api"


def get_visibility(
    target,
    start_date,
    days=2,
    latitude=-89.5,
    longitude=0.0,
    step_minutes=60
):
    # Convert date string to datetime
    start = datetime.strptime(
        start_date, "%Y-%m-%d"
    ).replace(tzinfo=timezone.utc)

    end = start + timedelta(days=days)

    params = {
        "format": "json",
        "COMMAND": f"'{target}'",
        "EPHEM_TYPE": "'OBSERVER'",
        "MAKE_EPHEM": "'YES'",
        "OBJ_DATA": "'NO'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{longitude},{latitude},0'",
        "START_TIME": f"'{start:%Y-%m-%d %H:%M}'",
        "STOP_TIME": f"'{end:%Y-%m-%d %H:%M}'",
        "STEP_SIZE": f"'{step_minutes}m'",
        "QUANTITIES": "'4'",
        "CSV_FORMAT": "'YES'",
        "TIME_TYPE": "'UT'"
    }

    response = requests.get(URL, params=params, timeout=60)
    response.raise_for_status()

    data = response.json()

    if "error" in data:
        raise ValueError(data["error"])

    result = data.get("result", "")

    if "$$SOE" not in result or "$$EOE" not in result:
        raise ValueError(result[:1000])

    table = result.split("$$SOE", 1)[1].split("$$EOE", 1)[0]

    observations = []

    for row in csv.reader(table.strip().splitlines()):

        if len(row) < 5:
            continue

        time = datetime.strptime(
            row[0].strip(), "%Y-%b-%d %H:%M"
        ).replace(tzinfo=timezone.utc)

        azimuth = float(row[3].strip())
        elevation = float(row[4].strip())

        observations.append({
            "time": time,
            "azimuth": azimuth,
            "elevation": elevation,
            "visible": elevation > 0
        })

    return observations


# This section runs only when testing this file directly
if __name__ == "__main__":

    date = input("Enter mission start date (YYYY-MM-DD): ")
    days = int(input("Enter number of days: "))

    print("\nFetching NASA Sun data...")
    sun_data = get_visibility("10", date, days)

    print("Fetching NASA Earth data...")
    earth_data = get_visibility("399", date, days)

    print("\nTotal Sun observations:", len(sun_data))
    print("Total Earth observations:", len(earth_data))

    sun_times = [row["time"] for row in sun_data]
    earth_times = [row["time"] for row in earth_data]

    if sun_times != earth_times:
        raise ValueError("Sun and Earth timestamps do not match.")

    print("\nFirst five NASA observations:")

    for sun, earth in zip(sun_data[:5], earth_data[:5]):
        print({
            "time": sun["time"].isoformat(),
            "sun_elevation": sun["elevation"],
            "earth_elevation": earth["elevation"],
            "sun_visible": sun["visible"],
            "earth_visible": earth["visible"]
        })
