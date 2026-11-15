from task_rules import find_time_window
from openai import OpenAI
from dotenv import load_dotenv
import os
import json
from datetime import datetime

# Load API key
load_dotenv()

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

# Get mission description
user_input = input("Describe your lunar mission: ")

# Define the output format
mission_schema = {
    "type": "object",
    "properties": {
        "objective": {"type": "string"},
        "duration_hours": {"type": ["number", "null"]},
        "needs_sunlight": {"type": ["boolean", "null"]},
        "needs_communication": {"type": ["boolean", "null"]},
        "region": {"type": ["string", "null"]},
        "preferred_date": {"type": ["string", "null"]}
    },
    "required": [
        "objective",
        "duration_hours",
        "needs_sunlight",
        "needs_communication",
        "region",
        "preferred_date"
    ],
    "additionalProperties": False
}

# Ask Groq to extract mission requirements
response = client.chat.completions.create(
    model="openai/gpt-oss-20b",
    messages=[
        {
            "role": "system",
            "content": """
            You are a lunar mission requirement extractor.

            Extract only information provided by the user.
            Do not invent mission dates, coordinates,
            battery specifications, or landing locations.

            If information is missing, return null.
            Do not assume whether communication is direct
            or uses a relay.
            """
        },
        {
            "role": "user",
            "content": user_input
        }
    ],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "mission_requirements",
            "strict": True,
            "schema": mission_schema
        }
    }
)

# Convert response into a Python dictionary
mission = json.loads(response.choices[0].message.content)
# Convert accidental "null" strings into Python None
for key, value in mission.items():
    if isinstance(value, str) and value.strip().lower() == "null":
        mission[key] = None

# Display the extracted information
print("\nExtracted Mission Requirements:")
print(json.dumps(mission, indent=4))
# Ask for a date if the user did not provide an exact one
date_value = mission.get("preferred_date")

try:
    datetime.strptime(date_value, "%Y-%m-%d")
except (ValueError, TypeError):
    mission["preferred_date"] = input(
        "\nEnter mission start date (YYYY-MM-DD): "
    ).strip()
# Pass LLM output to the scheduling algorithm
result = find_time_window(mission)

print("\nScheduling Result:")
print(result)
