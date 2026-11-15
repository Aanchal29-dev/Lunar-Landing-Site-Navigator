"""Extract explicit updates to a previously described lunar mission."""

import json
import os

from dotenv import load_dotenv
from openai import OpenAI


load_dotenv()

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)


MISSION_UPDATE_SCHEMA = {
    "type": "object",
    "properties": {
        "is_followup": {"type": "boolean"},
        "objective": {"type": ["string", "null"]},
        "duration_hours": {"type": ["number", "null"]},
        "needs_sunlight": {"type": ["boolean", "null"]},
        "needs_communication": {"type": ["boolean", "null"]},
        "region": {"type": ["string", "null"]},
        "preferred_date": {"type": ["string", "null"]}
    },
    "required": [
        "is_followup",
        "objective",
        "duration_hours",
        "needs_sunlight",
        "needs_communication",
        "region",
        "preferred_date"
    ],
    "additionalProperties": False
}


def extract_mission_updates(question, previous_mission):
    """Return explicit changes requested for the previous mission.

    Unchanged fields are returned as ``None``. For boolean fields,
    ``False`` means the user explicitly disabled that requirement.
    """

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": """
                You identify explicit follow-up changes to a user's
                existing lunar mission.

                Return is_followup=true only when the question clearly
                refers to or changes the supplied previous mission.
                Return is_followup=false for unrelated questions and
                independent new mission requests.

                Extract only fields the user explicitly asks to change:
                objective, duration_hours, needs_sunlight,
                needs_communication, region, and preferred_date.
                For every omitted or unchanged field, return JSON null.
                For boolean fields, false means the user explicitly
                disabled that requirement; do not use null for that.

                Do not infer changes from the previous mission or fill
                values the user did not request. If is_followup is false,
                return null for every mission field. Express an explicitly
                requested date as YYYY-MM-DD only when unambiguous;
                otherwise return null for preferred_date.
                """
            },
            {
                "role": "user",
                "content": (
                    "Previous mission:\n"
                    f"{json.dumps(previous_mission, ensure_ascii=False)}"
                    "\n\nQuestion:\n"
                    f"{question}"
                )
            }
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "mission_updates",
                "strict": True,
                "schema": MISSION_UPDATE_SCHEMA
            }
        }
    )

    updates = json.loads(response.choices[0].message.content)

    # Keep the API result aligned with the contract even if a model
    # unexpectedly includes values for a non-follow-up question.
    if not updates["is_followup"]:
        for field in MISSION_UPDATE_SCHEMA["properties"]:
            if field != "is_followup":
                updates[field] = None

    return updates


def merge_mission_updates(previous_mission, updates):
    """Return a copy of a mission with explicit follow-up changes applied."""

    if updates.get("is_followup") is not True:
        raise ValueError("Cannot merge updates from a non-follow-up question.")

    merged_mission = previous_mission.copy()

    for field in (
        "objective",
        "duration_hours",
        "needs_sunlight",
        "needs_communication",
        "region",
        "preferred_date"
    ):
        value = updates.get(field)
        if value is not None:
            merged_mission[field] = value

    return merged_mission


if __name__ == "__main__":
    previous_mission = {
        "objective": "lunar surface exploration",
        "duration_hours": 4,
        "needs_sunlight": True,
        "needs_communication": True,
        "region": "south pole",
        "preferred_date": "2027-01-15"
    }

    question = input("Enter a mission follow-up question: ")
    print(json.dumps(
        extract_mission_updates(question, previous_mission),
        indent=2
    ))
