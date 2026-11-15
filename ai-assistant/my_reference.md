
# Lunar Compass — Project Knowledge

## Project Overview
Lunar Compass is an educational lunar mission planning
application developed for NASA Space Apps Challenge 2026.

It helps users explore candidate lunar south-pole locations
and compare sunlight and direct Earth visibility.

## Smart Lunar Activity Scheduler
Lunar Exploration Assistant is a separate working prototype of an
AI-powered activity scheduler intended for integration
into Lunar Compass.

Users describe their lunar surface mission in natural language.

The application extracts:
- Mission objective
- Activity duration
- Sunlight requirements
- Direct Earth communication requirements
- Preferred region and date

## Technologies Used in the Working Prototype
- Python for scheduling calculations
- Groq API with gpt-oss-20b for natural language processing
- NASA JPL Horizons API for Sun and Earth position data
- Streamlit for the chatbot interface

## Current Capabilities
The working prototype:
- Extracts mission requirements using an LLM
- Retrieves NASA Sun and Earth elevation data
- Evaluates three lunar candidate locations
- Searches for suitable activity windows
- Displays location coordinates and UTC times
- Provides alternative locations

## Locations Currently Evaluated
- Mons Mouton — MMO01
- Mons Mouton Plateau — MMP03
- Nobile Rim 1 — NR101

## Current Limitations
- Uses a simplified smooth-horizon model
- Does not account for nearby terrain obstruction
- Checks visibility at 30-minute intervals
- Searches a three-day period
- Does not certify landing safety
- Selects the earliest eligible window, not the safest site
- Does not yet support true conversational follow-ups

## Planned Lunar Compass Features
- Interactive lunar map
- Historical lunar mission explorer
- Mission Stress Test
- Improved activity scheduling
- Better scientific visualizations

These planned features should not be described as
completed unless their implementation is confirmed.
