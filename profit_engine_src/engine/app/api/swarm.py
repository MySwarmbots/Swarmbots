from fastapi import APIRouter
from app.state import swarm_state, prediction_log, optimizer_state
router = APIRouter()
@router.get("/state")
def state():
    return swarm_state
@router.get("/predictions")
def predictions():
    return {"predictions": list(prediction_log)}
@router.get("/optimizer")
def optimizer():
    return optimizer_state
