from fastapi import APIRouter
from app.rollout_engine import (
    get_state, rollout_summary, record_validation, record_anomaly,
    promote, demote, set_stage, list_audit, initialize_capital
)

router = APIRouter()

@router.get("/state")
def state():
    return get_state()

@router.get("/summary")
def summary():
    return rollout_summary()

@router.post("/initialize")
def initialize():
    return initialize_capital()

@router.post("/validation")
def validation(passed: bool, reason: str = ""):
    return record_validation(passed, reason)

@router.post("/anomaly")
def anomaly(message: str = "anomaly_detected"):
    return record_anomaly(message)

@router.post("/promote")
def promote_route():
    return promote()

@router.post("/demote")
def demote_route(reason: str = "manual_demote"):
    return demote(reason)

@router.post("/set-stage")
def set_stage_route(stage: str):
    return set_stage(stage)

@router.get("/audit")
def audit():
    return {"audit": list_audit()}
