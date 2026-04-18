"""
Auto-execution service for the Space Dungeon swarm.
Takes swarm predictions, applies signal-intelligence adjustments, validates
preconditions, and places real Bitget orders. Also persists per-user config
(enabled flag, cooldown, position-sizing multipliers, quiet hours, etc.).
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from pydantic import BaseModel

import bitget_exchange as bgx
from server import db, ws_manager, logger, ensure_utc, notify_user


# ---------- Config state ----------

auto_exec_defaults = {
    "enabled": False,
    "max_trade_usd": 0.50,
    "min_confidence": 0.60,
    "allowed_symbols": ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
    "allowed_directions": ["long_bias", "short_bias"],
    "market_type": "spot",
    "cooldown_seconds": 300,
    "last_trade_ts": None,
    "total_trades": 0,
    "total_pnl_estimate": 0.0,
    "scheduler_enabled": False,
    "scheduler_interval_minutes": 15,
    "scheduler_symbols": ["BTCUSDT", "ETHUSDT"],
    "symbol_multipliers": {
        "BTC/USDT": 1.5, "ETH/USDT": 1.5, "XRP/USDT": 1.3, "ADA/USDT": 1.2,
        "DOGE/USDT": 1.0, "SOL/USDT": 1.0
    },
    "quiet_hours_utc": [9],
}


async def get_auto_exec_config():
    doc = await db.auto_exec_config.find_one({"_id": "main"})
    if not doc:
        await db.auto_exec_config.insert_one({"_id": "main", **auto_exec_defaults})
        return auto_exec_defaults.copy()
    doc.pop("_id", None)
    return doc


async def update_auto_exec_config(updates: dict):
    await db.auto_exec_config.update_one({"_id": "main"}, {"$set": updates}, upsert=True)
    return await get_auto_exec_config()


class AutoExecConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    max_trade_usd: Optional[float] = None
    min_confidence: Optional[float] = None
    allowed_symbols: Optional[List[str]] = None
    allowed_directions: Optional[List[str]] = None
    market_type: Optional[str] = None
    cooldown_seconds: Optional[int] = None
    scheduler_enabled: Optional[bool] = None
    scheduler_interval_minutes: Optional[int] = None
    scheduler_symbols: Optional[List[str]] = None
    symbol_multipliers: Optional[Dict[str, float]] = None
    quiet_hours_utc: Optional[List[int]] = None


# ---------- Signal intelligence ----------

async def _apply_signal_intelligence(prediction: dict) -> dict:
    """Adjust prediction confidence based on historical signal accuracy data."""
    direction = prediction.get("direction")
    symbol = prediction.get("symbol", "")
    confidence = prediction.get("confidence", 0)

    # Fetch recent accuracy stats for this symbol+direction
    checked_signals = await db.signal_accuracy.find(
        {"symbol": symbol, "direction": direction, "checked": True}
    ).sort("created_at", -1).limit(50).to_list(50)

    if len(checked_signals) < 5:
        prediction["intelligence_applied"] = False
        return prediction

    correct = sum(1 for s in checked_signals if s.get("correct"))
    historical_wr = correct / len(checked_signals)

    # WR > 80% → boost up to +15%, WR < 30% → penalize up to -20%
    if historical_wr >= 0.80:
        adjustment = min((historical_wr - 0.80) * 0.75, 0.15)
        new_confidence = min(confidence + adjustment, 0.99)
    elif historical_wr <= 0.30:
        adjustment = min((0.30 - historical_wr) * 1.0, 0.20)
        new_confidence = max(confidence - adjustment, 0.05)
    else:
        new_confidence = confidence

    prediction["original_confidence"] = confidence
    prediction["confidence"] = round(new_confidence, 4)
    prediction["intelligence_applied"] = True
    prediction["historical_win_rate"] = round(historical_wr, 3)
    prediction["confidence_adjustment"] = round(new_confidence - confidence, 4)

    return prediction


# ---------- Execution helpers ----------

def _normalize_symbol(symbol_raw: str) -> str:
    if "/" not in symbol_raw and "USDT" in symbol_raw:
        return symbol_raw.replace("USDT", "/USDT")
    if "/" not in symbol_raw and "USDC" in symbol_raw:
        return symbol_raw.replace("USDC", "/USDC")
    return symbol_raw


def _check_exec_preconditions(config: dict, prediction: dict) -> str:
    """Returns a block reason string, or empty string if all checks pass."""
    if not config.get("enabled"):
        return "auto_exec_disabled"
    if not bgx.is_configured():
        return "bitget_not_configured"

    direction = prediction.get("direction")
    confidence = prediction.get("confidence", 0)
    ccxt_symbol = _normalize_symbol(prediction.get("symbol", "BTCUSDT"))

    if direction == "wait":
        return "prediction_is_wait"
    if direction not in config.get("allowed_directions", ["long_bias", "short_bias"]):
        return f"direction_{direction}_not_allowed"

    # Quiet hours check (UTC)
    current_hour_utc = datetime.now(timezone.utc).hour
    quiet_hours = config.get("quiet_hours_utc", [])
    if current_hour_utc in quiet_hours:
        return f"quiet_hour_{current_hour_utc}utc"

    if confidence < config.get("min_confidence", 0.60):
        return f"confidence_{confidence}_below_threshold_{config['min_confidence']}"
    if ccxt_symbol not in config.get("allowed_symbols", []):
        return f"symbol_{ccxt_symbol}_not_allowed"

    # Cooldown check
    last_ts = config.get("last_trade_ts")
    if last_ts:
        try:
            last_dt = ensure_utc(last_ts)
            if last_dt:
                elapsed = (datetime.now(timezone.utc) - last_dt).total_seconds()
                cooldown = config.get("cooldown_seconds", 300)
                if elapsed < cooldown:
                    return f"cooldown_active_{int(cooldown - elapsed)}s_remaining"
        except (ValueError, TypeError) as e:
            logger.warning(f"Cooldown parse error: {e}")

    return ""


async def _place_auto_order(config, ccxt_symbol, side, max_usd, confidence, direction):
    """Fetch price, place order, log trade, broadcast."""
    try:
        ticker = await bgx.fetch_ticker(ccxt_symbol, config.get("market_type", "spot"))
        price = ticker.get("last", 0)
        if not price or price <= 0:
            return {"executed": False, "reason": "could_not_fetch_price"}
    except Exception as e:
        return {"executed": False, "reason": f"ticker_error_{str(e)[:50]}"}

    quantity = round(max_usd / price, 8)
    if quantity <= 0:
        return {"executed": False, "reason": "quantity_too_small"}

    order = None
    try:
        order = await bgx.create_order(
            ccxt_symbol, side, "market", quantity,
            market_type=config.get("market_type", "spot"),
            params={"cost": max_usd} if side == "buy" else None
        )
        if "error" in order:
            return {"executed": False, "reason": f"order_error_{order['error'][:80]}"}
    except Exception as e:
        logger.error(f"Auto-exec order failed: {e}")
        return {"executed": False, "reason": f"execution_error_{str(e)[:80]}"}

    # Success path — log and broadcast
    await update_auto_exec_config({
        "last_trade_ts": datetime.now(timezone.utc).isoformat(),
        "total_trades": config.get("total_trades", 0) + 1,
    })

    trade_record = {
        "source": "dungeon_auto_exec", "symbol": ccxt_symbol, "side": side,
        "quantity": quantity, "price": price, "notional_usd": max_usd,
        "confidence": confidence, "direction": direction,
        "order_id": order.get("id"), "order_status": order.get("status"),
        "created_at": datetime.now(timezone.utc)
    }
    await db.auto_exec_trades.insert_one(trade_record)

    await ws_manager.broadcast({"type": "auto_exec_trade", "data": {
        "symbol": ccxt_symbol, "side": side, "quantity": quantity,
        "price": price, "confidence": confidence, "direction": direction,
        "order_id": order.get("id"), "status": order.get("status"),
    }})

    for uid in list(ws_manager.active_connections.keys()):
        await notify_user(uid, "Auto-Trade Executed",
            f"SWARM {side.upper()} {ccxt_symbol} — Qty: {quantity} @ ${price:,.2f} (Conf: {confidence*100:.0f}%)",
            "success")

    return {"executed": True, "order": order, "trade": trade_record}


async def auto_execute_prediction(prediction: dict):
    """Core auto-execution: takes a swarm prediction and places a real Bitget order if conditions are met."""
    config = await get_auto_exec_config()

    # Apply signal intelligence adjustments
    prediction = await _apply_signal_intelligence(prediction)

    # Validate preconditions
    block_reason = _check_exec_preconditions(config, prediction)
    if block_reason:
        return {"executed": False, "reason": block_reason}

    direction = prediction.get("direction")
    confidence = prediction.get("confidence", 0)
    ccxt_symbol = _normalize_symbol(prediction.get("symbol", "BTCUSDT"))
    side = "buy" if direction == "long_bias" else "sell"
    max_usd = config.get("max_trade_usd", 0.50)

    # Scale position size by confidence and symbol multiplier
    sym_multipliers = config.get("symbol_multipliers", {})
    sym_mult = sym_multipliers.get(ccxt_symbol, 1.0)
    conf_mult = min(confidence / 0.60, 1.5)
    scaled_usd = round(max_usd * conf_mult * sym_mult, 2)

    return await _place_auto_order(config, ccxt_symbol, side, scaled_usd, confidence, direction)
