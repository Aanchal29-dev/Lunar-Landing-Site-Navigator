# Prototype status

This folder preserves the original exploration-assistant prototype and its
research/advisor experiments. It is not started or deployed by Lunar Compass.

The supported integration is the FastAPI route at `backend/app/assistant/` and
the panel in `Three.js/`. It keeps provider credentials on the server and sends
Sun/Earth questions to the shared visibility engine. In particular, do not use
`timeline_data.py` or the fixed demo-window advisors as a second source of
mission calculations. See `backend/README.md` for supported configuration.
