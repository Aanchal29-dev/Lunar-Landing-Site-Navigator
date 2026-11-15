import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ["LUNAR_COMPASS_CONTACT"] = "aanchal9ipsvig@gmail.com"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000"

# pyrefly: ignore[missing-import]
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, workers=1, reload=False)
