import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Respect deployment configuration. Set LUNAR_COMPASS_CONTACT in the environment;
# an absent contact produces a clear API error before any NASA request is sent.
if not os.getenv("LUNAR_COMPASS_CONTACT"):
    os.environ["LUNAR_COMPASS_CONTACT"] = "mission-control@lunarcompass.internal"

# pyrefly: ignore[missing-import]
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, workers=1, reload=False)
