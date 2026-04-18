"""Profit Engine HTTP routes."""
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

import profit_engine as pe
from server import ws_manager, get_current_user, notify_user

router = APIRouter()


class EngineConfigUpdate(BaseModel):
    base_confidence_threshold: Optional[float] = None
    top_signal_count: Optional[int] = None
    max_position_notional_usd: Optional[float] = None
    max_daily_loss_usd: Optional[float] = None
    kill_switch: Optional[str] = None
    cooldown_bars: Optional[int] = None

@router.get("/engine/swarm")
async def engine_swarm():
    return pe.swarm_state

@router.get("/engine/optimizer")
async def engine_optimizer():
    return pe.optimizer_state

@router.get("/engine/predictions")
async def engine_predictions():
    return {"predictions": list(pe.prediction_log)}

@router.get("/engine/positions")
async def engine_positions():
    return {"positions": list(pe.positions.values())}

@router.get("/engine/pnl")
async def engine_pnl():
    return {"realized_pnl_usd": pe.realized_pnl_usd}

@router.get("/engine/orders")
async def engine_orders():
    return {"orders": list(pe.order_log)}

@router.get("/engine/trades")
async def engine_trades():
    return {"trades": list(pe.trade_log)}

@router.get("/engine/config")
async def engine_config():
    return {
        "base_confidence_threshold": pe.BASE_CONFIDENCE_THRESHOLD,
        "top_signal_count": pe.TOP_SIGNAL_COUNT,
        "max_position_notional_usd": pe.MAX_POSITION_NOTIONAL_USD,
        "max_daily_loss_usd": pe.MAX_DAILY_LOSS_USD,
        "kill_switch": pe.KILL_SWITCH,
        "cooldown_bars": pe.COOLDOWN_BARS,
    }

@router.patch("/engine/config")
async def update_engine_config(data: EngineConfigUpdate, request: Request):
    await get_current_user(request)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    pe.update_config(updates)
    # Broadcast via WS
    await ws_manager.broadcast({"type": "engine_config", "data": updates})
    return await engine_config()

@router.post("/engine/execute-snapshot")
async def engine_execute_snapshot(snapshot: pe.SignalSnapshot, request: Request):
    await get_current_user(request)
    pred = pe.build_prediction(snapshot)
    result = pred.model_dump()
    pe.prediction_log.appendleft(result)
    await ws_manager.broadcast({"type": "engine_prediction", "data": result})
    return result

@router.post("/engine/webhook/tradingview")
async def engine_tradingview_webhook(payload: pe.TradingViewWebhook):
    result = pe.process_webhook(payload)
    await ws_manager.broadcast({"type": "engine_webhook", "data": result})
    # If trade executed, notify all connected users
    if result.get("status") == "executed":
        for uid in ws_manager.active_connections:
            await notify_user(uid, "Trade Executed",
                f"{result['position']['side'].upper()} {result['position']['symbol']} — Qty: {result['position']['quantity']} @ ${payload.price}",
                "success")
    return result

@router.post("/engine/backtest")
async def engine_backtest(snapshots: list[pe.SignalSnapshot], request: Request):
    await get_current_user(request)
    return pe.run_backtest(snapshots)
