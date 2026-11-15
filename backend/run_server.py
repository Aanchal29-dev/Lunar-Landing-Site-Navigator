import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set LUNAR_COMPASS_CONTACT to a real monitored team email or public contact URL
# before starting the server. The API returns a clear 503 if it is absent or invalid.

# pyrefly: ignore[missing-import]
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, workers=1, reload=False)
