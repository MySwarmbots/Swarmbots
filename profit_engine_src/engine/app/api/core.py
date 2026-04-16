from fastapi import APIRouter
from app.models import SignalSnapshot
from app.core_engine import build_prediction
router = APIRouter()
@router.post("/execute-snapshot")
def execute_snapshot(snapshot: SignalSnapshot):
    return build_prediction(snapshot).model_dump()
