"""Compatibility entry point; use app.main:app for the shared backend."""

from .main import app  # Reuse the same routes, CORS, lifespan and safe validation.
