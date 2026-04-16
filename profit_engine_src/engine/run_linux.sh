#!/usr/bin/env bash
set -e
cp -n .env.example .env || true
python3 -m venv .venv || true
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
