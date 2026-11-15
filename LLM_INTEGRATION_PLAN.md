# Lunar Exploration Assistant integration plan

## Review baseline

Reviewed remote main at `8a7b41b`, which merges `6494569` (Lunar Exploration
Assistant). The application checkout remains at `3448b58` during planning.
This document describes proposed work; it does not claim the new assistant
has been deployed or tested with Groq.

The commit adds a separate Streamlit application in `ai-assistant/`. It adds
no FastAPI assistant route or Three.js chat interface. Reuse its advisor logic,
battery calculations, source formatting and tests, preserving contributor history.

## Confirmed integration gaps

- `portal.py` owns UI, routing and mission memory through Streamlit session state.
  Those responsibilities must be separated before use from FastAPI.
- `timeline_data.py` calls Horizons directly through requests, without the
  engine's shared request gate or application identification. `task_rules.py`
  requests 30-minute boundary samples over three days. This differs from the
  main engine's hourly midpoint contract and must not become a second engine.
- Visibility, historical proximity and ice branches in `portal.py` use a fixed
  Mons Mouton demonstration site. `visibility_advisor.py` uses a fixed
  2026-11-17, 24-hour window. Neither represents the user's selected mission.
- `navigator_client.py` hardcodes localhost and permits only 45 seconds for
  visibility. Two serial Horizons calls and queued analyses may take longer.
- Several modules instantiate Groq clients on import. A missing key can fail
  import before the Streamlit portal displays its configuration error.
- The new directory has no dependency manifest. Existing backend CI only runs
  backend tests and its path filters do not cover assistant-only changes.

## Target architecture

Three.js chat panel -> POST /api/assistant/chat -> validated assistant service
-> existing backend domain services for calculations; Groq for language tasks;
NASA NTRS and curated references for source-backed science explanations.

Keep the current Three.js design. Run the integrated assistant inside the same
FastAPI worker as the visibility engine, using its shared HTTP client and NASA
gate. Keep Streamlit optional as a development client, rather than embedding a
second application with separate state in the presentation frontend.

## Phase 1: Package and configure

Fast-forward the clean checkout to the reviewed remote commit before code work.
Move reusable logic into `backend/app/assistant/` with package-relative imports;
keep the Streamlit entry point optional and thin. Store reference files beside
the package and resolve their paths relative to the module.

Create the provider client lazily, configure `GROQ_API_KEY` and `GROQ_MODEL` on
the server, and document optional dependencies and an example environment file.
Never expose credentials in Vite variables or browser requests. Missing provider
configuration must leave all scientific APIs operational. Report assistant
availability separately from existing backend readiness. Continue single-worker
deployment initially so the process-wide NASA gate remains effective.

## Phase 2: Define context and service contract

Add assistant request/response models and a thin router. Requests carry bounded
message/history data and an explicit context: latitude, east-positive longitude,
UTC mission start and duration when known. Reuse existing validation and signed
longitude conversion. A selected point without a date/duration is incomplete;
ask for those values instead of silently using a demonstration window.

Responses carry status (`ok`, `needs_input`, `unavailable`), answer text, the
context actually used, structured evidence/results, citations and limitations.
Use bounded browser-session conversation state initially, cleared with Clear
Chat, with no global shared conversation. Treat previous messages and browser
results as untrusted; recompute scientific results or reuse only server-verified
results keyed by their exact inputs. Bound message size, history, output length,
tool-call count and concurrent model requests. Avoid logging credentials or
whole conversations.

## Phase 3: Ground advisors in the existing engine

Replace integrated use of `timeline_data.py` with calls to existing visibility,
terrain, history, ice and comparison services. Keep numeric result cards and
limitations deterministic. Groq may explain those results but cannot overwrite
their fields or choose arbitrary URLs, filesystem paths or executable code.
Validate any model-proposed tool name and arguments against an explicit allowlist.

Preserve CENTER coord@301, targets 10/399, apparent airless angles, explicit UTC,
144 midpoint samples for 144 hours, elevation > 0 and all four metrics. Carry
upstream errors and partial failures through without invented fallback data.
Remove fixed site/window assumptions from the integrated advisors and validate
returned context before formatting an answer.

Replace the legacy half-hour scheduler with explicitly bounded candidate
evaluations using existing services. Document the move to whole-hour durations
and sampled visibility; do not imply continuous illumination between samples or
a globally optimal/safe mission. A half-hour scheduling mode needs a separate
scientific contract and is outside this integration.

Use async provider/network access and bounded deadlines; isolate blocking raster
work from the event loop. Keep the NASA gate around upstream NASA work only, not
around Groq calls. Preserve errors rather than broadly catching programming bugs.

## Phase 4: Connect the current frontend

Add `assistant.js` plus a chat panel integrated with the existing navigation and
API helper. Use the existing same-origin Vite proxy. Bind the panel to the actual
selected Moon point and active mission inputs. Show those inputs beside answers.
Changing a point or date invalidates pending answers for the old context.

Support loading, cancellation, retry, missing-input prompts, missing provider
configuration, source links and Clear Chat. Render model text safely with raw
HTML disabled and validated citation links. Explain that chat text is sent to
Groq and science searches may send keywords to NASA. The assistant must remain
optional for ordinary analysis, navigation and comparisons.

## Phase 5: Evidence and verification

Treat NTRS abstracts and retrieved text as evidence, never as instructions.
Return only source identifiers and URLs actually retrieved or curated. Retain
publication dates and uncertainty; citation existence does not prove a generated
claim. Distinguish retrieval failure from an empty search. Present battery inputs,
units and illustrative assumptions explicitly, with no landing-safety claims.

Port the existing assistant tests and add regressions for selected-site/window
context, missing key startup, malformed model output, unknown tools, provider
timeouts/429s, NASA failure, partial data, cancellation and isolated chat state.
Run overlapping chat and direct analysis requests against a simulated NASA
transport and require maximum upstream concurrency of one.

Extend CI to collect assistant tests and trigger on their changes. Run backend,
frontend unit/build and browser checks; cover ordinary and reduced-motion
navigation. Verify a browser-selected southern/western site reaches the correct
tool arguments and that changing selection suppresses stale chat results.

Finally, with a real server-side Groq key, test a science question, a selected-site
visibility question, a follow-up date change and unavailable NASA behavior. Check
the 144-hour mission against direct /api/analyze. Clearly distinguish mocked
tests from actual provider verification. Commit coherent implementation steps and
publish only after checks pass and the remaining limits are documented.

## Completion criteria

The existing Moon interface has a usable assistant; every numeric scientific
answer comes from the shared backend; selected coordinates and mission windows
match across UI, request and answer; provider failures do not break analysis;
all required tests pass. A live Groq check requires a valid key configured locally,
not pasted into chat or committed to Git. No new runtime services or databases
are required for this initial integration.
