from fastapi import APIRouter
from app.validation_engine import validate_fill, list_runs, gate_state, set_gate, validation_summary

router = APIRouter()

@router.get("/gate")
def gate():
    return gate_state()

@router.post("/gate")
def update_gate(mode: str, blocked: bool = False, reason: str = ""):
    return set_gate(mode, blocked, reason)

@router.post("/run")
def run(symbol: str, exchange: str, expected_price: float, actual_price: float, expected_fee_bps: float = 6.0, actual_fee_bps: float = 6.0):
    return validate_fill(symbol, exchange, expected_price, actual_price, expected_fee_bps, actual_fee_bps)

@router.get("/runs")
def runs():
    return {"runs": list_runs()}

@router.get("/summary")
def summary():
    return validation_summary()
