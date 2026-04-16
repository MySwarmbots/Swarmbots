from fastapi import APIRouter
from app.validation_engine import validation_summary

router = APIRouter()

@router.get("/health")
def health():
    return {"status": "ok", "validation": validation_summary()}
