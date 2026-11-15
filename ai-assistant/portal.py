
import os
import json
import re
from datetime import date, datetime, timedelta

import streamlit as st
from dotenv import load_dotenv
from openai import OpenAI

from task_rules import find_time_window
from task_sorter import detect_intent
from study_notes import answer_verified_question
from mission_followup import (
    extract_mission_updates,
    merge_mission_updates
)
from navigator_client import (
    find_nearby_ice,
    get_historical_missions,
    analyze_visibility,
    NavigatorClientError,
)
from site_catalog import SITES
from historical_mission_advisor import (
    fetch_nearby_historical_missions,
)
from water_ice_advisor import (
    fetch_water_ice_response,
)
from visibility_advisor import (
    fetch_visibility_response,
)
from battery_advisor import (
    answer_battery_question,
)
from project_advisor import (
    answer_project_question,
)
from advisor_routing import select_advisor_route


def render_assistant_content(content):
    sources_heading = re.search(
        r"(?im)^###\s+(Sources(?:\s+consulted)?)\s*$",
        content
    )
    if not sources_heading:
        st.markdown(content)
        return

    st.markdown(content[:sources_heading.start()].rstrip())
    st.markdown(f"### {sources_heading.group(1)}")

    source_lines = []
    other_lines = []
    for line in content[sources_heading.end():].splitlines():
        match = re.match(r"^\[(\d+)\]\s+(.+)$", line.strip())
        if match and " — " in match.group(2):
            title, url = match.group(2).rsplit(" — ", 1)
            if url.startswith(("https://", "http://")):
                source_lines.append((match.group(1), title, url))
                continue
        other_lines.append(line)

    if other_lines and "".join(other_lines).strip():
        st.markdown("\n".join(other_lines).strip())

    for number, title, url in source_lines:
        st.markdown(f"- [{number}] [{title}](<{url}>)")


# ----------------------------------------
# 1. Load environment variables
# ----------------------------------------

load_dotenv()

st.set_page_config(
    page_title="Lunar Exploration Assistant",
    page_icon="🌙",
    layout="wide"
)

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    st.error("Groq API key not found. Check your .env file.")
    st.stop()

client = OpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1"
)


# ----------------------------------------
# 2. Define the expected LLM output
# ----------------------------------------

schema = {
    "type": "object",
    "properties": {
        "objective": {"type": "string"},
        "duration_hours": {
            "type": ["number", "null"]
        },
        "needs_sunlight": {
            "type": ["boolean", "null"]
        },
        "needs_communication": {
            "type": ["boolean", "null"]
        },
        "region": {
            "type": ["string", "null"]
        },
        "preferred_date": {
            "type": ["string", "null"]
        }
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


# ----------------------------------------
# 3. Understand the user's mission
# ----------------------------------------

def understand_mission(message):

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": """
                You are a lunar mission requirement extractor.

                Extract only the mission requirements
                explicitly provided by the user.

                Identify:
                - Mission objective
                - Duration in hours
                - Sunlight requirement
                - Earth communication requirement
                - Preferred lunar region
                - Preferred date

                Do not invent dates, coordinates,
                durations, or landing locations.

                If information is missing, use JSON null.
                Never return the string "null".

                Return requirements using the given schema.
                """
            },
            {
                "role": "user",
                "content": message
            }
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "mission_requirements",
                "strict": True,
                "schema": schema
            }
        }
    )

    mission = json.loads(
        response.choices[0].message.content
    )

    # Fix accidental "null" strings
    for key, value in mission.items():
        if isinstance(value, str):
            if value.strip().lower() == "null":
                mission[key] = None

    return mission


# ----------------------------------------
# 4. Generate a friendly explanation
# ----------------------------------------

def generate_explanation(mission, result):

    status = result.get("status")

    if status == "window_found":

        recommendation = result["recommended"]

        # Convert ISO datetime into readable format
        start = datetime.fromisoformat(
            recommendation["start_time"]
        ).strftime("%d %B %Y, %H:%M UTC")

        end = datetime.fromisoformat(
            recommendation["end_time"]
        ).strftime("%d %B %Y, %H:%M UTC")

        alternatives = result.get("alternatives", [])

        reply = (
            f"### 🌙 Mission Analysis Complete\n\n"
            f"I found a possible activity window for your "
            f"mission: **{mission['objective']}**.\n\n"

            f"**Recommended candidate location:** "
            f"{recommendation['site']}\n\n"

            f"**Mission start:** {start}\n\n"
            f"**Mission end:** {end}\n\n"

            f"**Mission duration:** "
            f"{mission['duration_hours']} hours\n\n"

            f"**Coordinates:** "
            f"{recommendation['latitude']}° latitude, "
            f"{recommendation['longitude']}° longitude.\n\n"

            f"### Why this window?\n\n"
            f"The selected time window satisfies your "
            f"specified visibility requirements at the "
            f"sampled intervals, based on astronomical "
            f"data from NASA JPL Horizons.\n\n"

            f"I also found **{len(alternatives)} "
            f"alternative candidate location(s)** "
            f"with matching activity windows.\n\n"

            f"**Important:** These results use a simplified "
            f"horizon model. Nearby hills and craters may "
            f"block sunlight or direct Earth visibility. "
            f"This is not confirmation of landing safety "
            f"or operational feasibility."
        )

        return reply

    elif status == "no_window":

        return (
            "### No Suitable Window Found\n\n"
            "I couldn't find an activity window that "
            "satisfies all your requirements at the "
            "successfully checked sites during the "
            "selected search period.\n\n"
            "You can try changing the mission date, "
            "duration, or visibility requirements.\n\n"
            "This does not mean the mission is impossible "
            "at other locations or times."
        )

    elif status == "missing_requirements":

        return (
            "### More Information Needed\n\n"
            "Please specify your mission duration and "
            "whether sunlight and direct Earth "
            "communication are required."
        )

    else:

        return (
            "### Unable to Complete Scheduling\n\n"
            f"Status: {status}\n\n"
            f"{result.get('message', 'Please review the mission inputs.')}"
        )


# ----------------------------------------
# 5. Application interface
# ----------------------------------------

st.title("🌙 Lunar Exploration Assistant")

st.caption(
    "AI-powered lunar activity scheduling assistant"
)

st.info(
    "Powered by Groq LLM and NASA JPL Horizons. "
    "Results are preliminary smooth-horizon estimates, "
    "not certified landing or mission safety assessments."
)


# ----------------------------------------
# 6. Sidebar settings
# ----------------------------------------

with st.sidebar:

    st.header("Mission Settings")

    mission_date = st.date_input(
        "Search starting date",
        value=date.today() + timedelta(days=2)
    )

    st.divider()

    st.write("**Search period:** 3 days")
    st.write("**Candidate locations:** 3")
    st.write("**Sampling interval:** 30 minutes")

    st.divider()

    st.caption(
        "Select a starting date and describe "
        "your lunar surface mission in the chat."
    )

    if st.button("Clear Chat"):
        st.session_state.messages = []
        st.session_state.last_mission = None
        st.rerun()


# ----------------------------------------
# 7. Initialize chat history
# ----------------------------------------

if "messages" not in st.session_state:
    st.session_state.messages = []

if "last_mission" not in st.session_state:
    st.session_state.last_mission = None

st.sidebar.subheader("Current Mission")
mission_memory_display = st.sidebar.empty()


def render_current_mission(mission):
    if mission is None:
        mission_memory_display.write("No mission planned yet")
        return

    sunlight = mission.get("needs_sunlight")
    communication = mission.get("needs_communication")
    sunlight_text = (
        "Required" if sunlight is True else
        "Not required" if sunlight is False else
        "Not specified"
    )
    communication_text = (
        "Required" if communication is True else
        "Not required" if communication is False else
        "Not specified"
    )

    mission_memory_display.markdown(
        f"**Mission objective:** {mission.get('objective') or 'Not specified'}\n\n"
        f"**Duration:** {mission.get('duration_hours') or 'Not specified'}"
        f"{' hours' if mission.get('duration_hours') is not None else ''}\n\n"
        f"**Sunlight:** {sunlight_text}\n\n"
        f"**Earth communication:** {communication_text}\n\n"
        f"**Region:** {mission.get('region') or 'Not specified'}\n\n"
        f"**Preferred date:** {mission.get('preferred_date') or 'Not specified'}"
    )


render_current_mission(st.session_state.last_mission)


# Display previous messages
for message in st.session_state.messages:

    with st.chat_message(message["role"]):
        render_assistant_content(message["content"])


# ----------------------------------------
# 8. Chat input
# ----------------------------------------

prompt = st.chat_input(
    "Describe your lunar surface mission..."
)


if prompt:

    # Save user message
    st.session_state.messages.append({
        "role": "user",
        "content": prompt
    })

    with st.chat_message("user"):
        st.write(prompt)


    # Generate assistant response
    with st.chat_message("assistant"):

        try:

            route = select_advisor_route(
                prompt,
                has_saved_mission=st.session_state.last_mission is not None,
            )
            if route is None:
                with st.spinner("Understanding your question..."):
                    intent = detect_intent(prompt)
                route = select_advisor_route(
                    prompt,
                    has_saved_mission=st.session_state.last_mission is not None,
                    classified_intent=intent,
                )

            # Answer questions about the team's project from local project notes.
            if route == "project":
                try:
                    with st.spinner("Checking Lunar Compass project notes..."):
                        reply = answer_project_question(prompt, client)
                    render_assistant_content(reply)
                except Exception:
                    reply = (
                        "I couldn't prepare a project-specific answer right now. "
                        "Please try again; I haven't substituted unverified "
                        "project details."
                    )
                    st.warning(reply)

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": reply
                })
                st.stop()

            # Battery estimates use explicit user inputs and deterministic math.
            # Check this before visibility so "without sunlight" battery
            # questions are not routed to the visibility-only demo.
            if route == "battery":
                reply = answer_battery_question(prompt)
                st.markdown(reply)
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": reply
                })
                st.stop()

            # Answer location-specific illumination and Earth-view questions
            # using deterministic results from the local Horizons backend.
            if route == "visibility":
                demo_site = next(
                    (
                        site for site in SITES
                        if site["name"] == "Mons Mouton - MMO01"
                    ),
                    None,
                )

                if demo_site is None:
                    reply = (
                        "The Mons Mouton MMO01 demonstration location is not "
                        "available in the local site catalog, so visibility "
                        "cannot be evaluated."
                    )
                    st.warning(reply)
                else:
                    try:
                        with st.spinner(
                            "Analyzing Sun and Earth visibility..."
                        ):
                            reply = fetch_visibility_response(
                                demo_site["name"],
                                demo_site["latitude"],
                                demo_site["longitude"],
                                analyze_visibility,
                                prompt,
                            )
                        render_assistant_content(reply)
                    except NavigatorClientError:
                        reply = (
                            "I couldn't retrieve Sun and Earth visibility data "
                            "because the Lunar Compass backend or its NASA "
                            "Horizons request is unavailable or timed out. "
                            "Please check the backend and try again. No fallback "
                            "measurements were used."
                        )
                        st.warning(reply)

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": reply
                })
                st.stop()

            # Answer historical lunar location questions before general RAG.
            if route == "historical_mission":
                demo_site = next(
                    (
                        site for site in SITES
                        if site["name"] == "Mons Mouton - MMO01"
                    ),
                    None,
                )

                if demo_site is None:
                    reply = (
                        "The Mons Mouton MMO01 demonstration location is not "
                        "available in the local site catalog, so historical "
                        "distances cannot be calculated."
                    )
                    st.warning(reply)
                else:
                    try:
                        with st.spinner(
                            "Checking documented lunar mission locations..."
                        ):
                            reply = fetch_nearby_historical_missions(
                                demo_site["name"],
                                demo_site["latitude"],
                                demo_site["longitude"],
                                get_historical_missions,
                            )
                        render_assistant_content(reply)
                    except NavigatorClientError:
                        reply = (
                            "I couldn't retrieve historical lunar mission "
                            "locations because the Lunar Compass backend is "
                            "unavailable or returned an error. Please check "
                            "that it is running at http://127.0.0.1:8000 and "
                            "try again. No distances were substituted."
                        )
                        st.warning(reply)

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": reply
                })
                st.stop()

            # Handle specific water-ice location questions deterministically
            # before the general Groq intent classifier and NASA RAG branch.
            if route == "water_ice":
                demo_site = next(
                    (
                        site for site in SITES
                        if site["name"] == "Mons Mouton - MMO01"
                    ),
                    None,
                )

                if demo_site is None:
                    reply = (
                        "The Mons Mouton MMO01 demonstration location is not "
                        "available in the local site catalog. No coordinates "
                        "or water-ice measurements were substituted."
                    )
                    st.warning(reply)
                else:
                    try:
                        with st.spinner(
                            "Checking nearby water-ice references..."
                        ):
                            reply = fetch_water_ice_response(
                                demo_site["name"],
                                demo_site["latitude"],
                                demo_site["longitude"],
                                find_nearby_ice,
                            )
                        render_assistant_content(reply)
                    except NavigatorClientError:
                        reply = (
                            "I couldn't retrieve nearby water-ice references "
                            "because the Lunar Compass backend is unavailable "
                            "or returned an error. Please check that it is "
                            "running at http://127.0.0.1:8000 and try again. "
                            "No fallback measurements were used."
                        )
                        st.warning(reply)

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": reply
                })
                st.stop()

            # Case 1: Moon or NASA knowledge question
            if route == "nasa_rag":

                with st.spinner("Checking scientific references..."):
                    reply = answer_verified_question(prompt)

                render_assistant_content(reply)

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": reply
                })

                st.stop()

            # Case 2: Unrelated question
            if route == "other":

                reply = (
                    "I'm a lunar exploration assistant. "
                    "I can help you schedule lunar surface "
                    "activities or answer questions about "
                    "the Moon, NASA, and space exploration."
                )

                st.markdown(reply)

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": reply
                })

                st.stop()

            # Case 3: Scheduling requests
            # The existing mission scheduling code
            # continues below without changes.


            # --------------------------------
            # Step A: Understand a new mission or update the saved one
            # --------------------------------

            is_followup = False

            if st.session_state.last_mission is not None:
                with st.spinner("Checking for mission follow-up..."):
                    updates = extract_mission_updates(
                        prompt,
                        st.session_state.last_mission
                    )

                if updates.get("is_followup") is True:
                    mission = merge_mission_updates(
                        st.session_state.last_mission,
                        updates
                    )
                    is_followup = True

            if not is_followup:
                with st.spinner(
                    "Understanding your mission..."
                ):
                    mission = understand_mission(prompt)

            # Show extracted JSON only if requested
            with st.expander(
                "View extracted mission requirements"
            ):
                st.json(mission)


            # --------------------------------
            # Step B: Apply selected date
            # --------------------------------

            # The sidebar date applies to new missions. Follow-ups keep
            # their saved date unless the user explicitly changed it.
            if not is_followup:
                mission["preferred_date"] = (
                    mission_date.isoformat()
                )


            # --------------------------------
            # Step C: NASA scheduling
            # --------------------------------

            with st.spinner(
                "Analyzing NASA visibility data..."
            ):
                result = find_time_window(mission)

            if result.get("status") in ("window_found", "no_window"):
                st.session_state.last_mission = mission.copy()
                render_current_mission(st.session_state.last_mission)


            # --------------------------------
            # Step D: Generate explanation
            # --------------------------------

            reply = generate_explanation(
                mission,
                result
            )

            st.markdown(reply)


            # --------------------------------
            # Step E: Show alternatives
            # --------------------------------

            if result.get("status") == "window_found":

                alternatives = result.get(
                    "alternatives", []
                )

                if alternatives:

                    with st.expander(
                        "Explore alternative locations"
                    ):

                        for item in alternatives:

                            st.write(
                                f"**{item['site']}**"
                            )

                            st.write(
                                "Latitude:",
                                item["latitude"]
                            )

                            st.write(
                                "Longitude:",
                                item["longitude"]
                            )

                            st.write(
                                "Start:",
                                item["start_time"]
                            )

                            st.write(
                                "End:",
                                item["end_time"]
                            )

                            st.divider()

            if result.get("failed_sites"):
                st.warning(
                    "Some locations could not be evaluated: "
                    + ", ".join(result["failed_sites"])
                )


            # --------------------------------
            # Step F: Save assistant message
            # --------------------------------

            st.session_state.messages.append({
                "role": "assistant",
                "content": reply
            })


        except Exception as error:

            st.error(
                "Something went wrong while processing "
                "your mission. Check the terminal for details."
            )

            print("Application error:", error)
