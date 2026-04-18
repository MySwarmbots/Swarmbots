"""
Scheduler routes: /dungeon/scheduler/status, /dungeon/scheduler/trigger.
The scheduler background loop (`scheduler_loop`) remains registered in server.py startup
because it is deeply coupled with prediction, auto-exec, telegram broadcast helpers.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Request

import swarm_dungeon as sd
from server import (
    db,
    ws_manager,
    get_current_user,
    get_auto_exec_config,
    auto_execute_prediction,
    _get_telegram_users,
    _broadcast_to_telegram,
    _format_prediction_telegram,
)

router = APIRouter()


@router.get("/dungeon/scheduler/status")
async def scheduler_status():
    config = await get_auto_exec_config()
    runs = await db.scheduler_runs.find({}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {
        "scheduler_enabled": config.get("scheduler_enabled", False),
        "interval_minutes": config.get("scheduler_interval_minutes", 15),
        "symbols": config.get("scheduler_symbols", []),
        "recent_runs": runs,
    }


@router.post("/dungeon/scheduler/trigger")
async def scheduler_trigger_now(symbol: str = "BTCUSDT", request: Request = None):
    """Manually trigger a scheduled prediction now."""
    if request:
        await get_current_user(request)
    config = await get_auto_exec_config()
    result = sd.aggregate_prediction(symbol)

    await db.scheduler_runs.insert_one({
        "symbol": symbol, "direction": result["direction"],
        "confidence": result["confidence"], "votes": result["votes"],
        "timestamp": result["timestamp"], "manual": True,
        "created_at": datetime.now(timezone.utc)
    })

    await ws_manager.broadcast({"type": "scheduler_prediction", "data": {
        "symbol": symbol, "direction": result["direction"],
        "confidence": result["confidence"], "votes": result["votes"],
    }})

    users_tg = await _get_telegram_users()
    await _broadcast_to_telegram(users_tg, _format_prediction_telegram(symbol, result))

    exec_result = None
    if config.get("enabled"):
        exec_result = await auto_execute_prediction(result)

    result["auto_exec"] = exec_result
    return result
