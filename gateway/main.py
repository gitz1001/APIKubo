"""Entrypoint: ``uvicorn main:app --port 8000`` (run from the gateway/ directory)."""

import logging

from app.main import create_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = create_app()
