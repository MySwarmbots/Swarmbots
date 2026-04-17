from fastapi import APIRouter
from app.swarm_engine import list_agents, run_debate, aggregate_prediction

router = APIRouter()

@router.get("/agents")
def agents():
    return {"agents": list_agents()}

@router.get("/debate")
def debate(symbol: str = "BTCUSDT", timeframe: str = "15m"):
    return {"symbol": symbol, "timeframe": timeframe, "debate": run_debate(symbol, timeframe)}

@router.get("/prediction")
def prediction(symbol: str = "BTCUSDT", timeframe: str = "15m"):
    return aggregate_prediction(symbol, timeframe)
