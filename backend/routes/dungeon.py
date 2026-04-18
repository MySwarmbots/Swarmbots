"""Space Dungeon swarm + rollout HTTP routes.
The scheduler loop + prediction helpers remain in server.py due to deep coupling.
"""
from fastapi import APIRouter, HTTPException, Request

import swarm_dungeon as sd
from server import (
    db,
    ws_manager,
    get_current_user,
    auto_execute_prediction,
    get_auto_exec_config,
    update_auto_exec_config,
    AutoExecConfigUpdate,
)

router = APIRouter()

@router.get("/dungeon/agents")
async def dungeon_agents():
    return {"agents": sd.generate_agents()}

@router.get("/dungeon/agents/{agent_id}")
async def dungeon_agent(agent_id: str):
    a = sd.get_agent(agent_id)
    if not a:
        raise HTTPException(status_code=404, detail="Agent not found")
    return a

@router.get("/dungeon/debate")
async def dungeon_debate(symbol: str = "BTCUSDT", timeframe: str = "15m"):
    stances = sd.run_debate(symbol, timeframe)
    await ws_manager.broadcast({"type": "dungeon_debate", "data": {"symbol": symbol, "stances_count": len(stances)}})
    return {"symbol": symbol, "timeframe": timeframe, "debate": stances}

@router.get("/dungeon/prediction")
async def dungeon_prediction(symbol: str = "BTCUSDT", timeframe: str = "15m", auto_exec: bool = True):
    result = sd.aggregate_prediction(symbol, timeframe)
    await ws_manager.broadcast({"type": "dungeon_prediction", "data": {"symbol": symbol, "direction": result["direction"], "confidence": result["confidence"]}})

    # Auto-execute if enabled
    exec_result = None
    if auto_exec:
        exec_result = await auto_execute_prediction(result)
    result["auto_exec"] = exec_result
    return result

@router.get("/dungeon/predictions")
async def dungeon_predictions():
    return {"predictions": list(sd.prediction_log)}

@router.get("/dungeon/debates")
async def dungeon_debates():
    return {"debates": list(sd.debate_log)}

# --- Auto-Exec Config API ---

@router.get("/dungeon/auto-exec/config")
async def get_auto_exec_cfg(request: Request):
    await get_current_user(request)
    return await get_auto_exec_config()

@router.patch("/dungeon/auto-exec/config")
async def patch_auto_exec_cfg(data: AutoExecConfigUpdate, request: Request):
    await get_current_user(request)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await update_auto_exec_config(updates)
    await ws_manager.broadcast({"type": "auto_exec_config", "data": result})
    return result

@router.get("/dungeon/auto-exec/trades")
async def get_auto_exec_trades(limit: int = 50, request: Request = None):
    if request:
        await get_current_user(request)
    trades = await db.auto_exec_trades.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"trades": trades}

@router.get("/dungeon/rollout")
async def dungeon_rollout():
    return sd.rollout_summary()

@router.post("/dungeon/rollout/promote")
async def dungeon_promote(request: Request):
    await get_current_user(request)
    result = sd.promote()
    await ws_manager.broadcast({"type": "dungeon_rollout", "data": result})
    return result

@router.post("/dungeon/rollout/demote")
async def dungeon_demote(reason: str = "manual_demote", request: Request = None):
    if request:
        await get_current_user(request)
    return sd.demote(reason)

@router.post("/dungeon/rollout/set-stage")
async def dungeon_set_stage(stage: str, request: Request = None):
    if request:
        await get_current_user(request)
    return sd.set_stage(stage)

@router.post("/dungeon/rollout/validation")
async def dungeon_validation(passed: bool, reason: str = ""):
    return sd.record_validation(passed, reason)

@router.post("/dungeon/rollout/anomaly")
async def dungeon_anomaly(message: str = "anomaly_detected"):
    return sd.record_anomaly(message)

@router.get("/dungeon/rollout/audit")
async def dungeon_audit():
    return {"audit": sd.get_audit()}
