from fastapi import APIRouter
from app.rollout_engine import rollout_summary

router = APIRouter()

@router.get("/health")
def health():
    return {"status": "ok", "rollout": rollout_summary()}
