"""
Signal accuracy tracker service.
Records entry prices when swarm predictions fire, then verifies them 15 min later
to build a rolling dataset of signal hit-rate used by the Signal Intelligence engine.
"""
from datetime import UTC, datetime, timedelta

import bitget_exchange as bgx
from server import db
from services.auto_exec import _normalize_symbol


async def _snapshot_price(symbol: str) -> float:
    """Fetch current price for a symbol via Bitget or return 0."""
    ccxt_sym = _normalize_symbol(symbol)
    try:
        ticker = await bgx.fetch_ticker(ccxt_sym, "spot")
        return ticker.get("last", 0) or 0
    except Exception:
        return 0


async def record_prediction_with_price(run: dict):
    """Attach entry price to a scheduler run for later accuracy check."""
    price = await _snapshot_price(run["symbol"])
    if price <= 0:
        return
    await db.signal_accuracy.insert_one({
        "symbol": run["symbol"],
        "direction": run["direction"],
        "confidence": run["confidence"],
        "entry_price": price,
        "exit_price": None,
        "pnl_pct": None,
        "correct": None,
        "checked": False,
        "created_at": datetime.now(UTC),
    })


async def check_pending_signals():
    """Check signals older than 15 min and record exit price + accuracy. Batched by symbol."""
    cutoff = datetime.now(UTC) - timedelta(minutes=15)
    pending = await db.signal_accuracy.find(
        {"checked": False, "created_at": {"$lt": cutoff}}
    ).limit(50).to_list(50)

    if not pending:
        return

    # Batch: fetch price once per unique symbol
    unique_symbols = list(set(s["symbol"] for s in pending))
    price_cache = {}
    for sym in unique_symbols:
        price_cache[sym] = await _snapshot_price(sym)

    # Update all pending signals using cached prices
    for sig in pending:
        exit_price = price_cache.get(sig["symbol"], 0)
        if exit_price <= 0:
            continue
        entry = sig["entry_price"]
        direction = sig["direction"]

        if direction == "long_bias":
            pnl_pct = round((exit_price - entry) / entry * 100, 4)
            correct = exit_price > entry
        elif direction == "short_bias":
            pnl_pct = round((entry - exit_price) / entry * 100, 4)
            correct = exit_price < entry
        else:
            pnl_pct = 0.0
            correct = None

        await db.signal_accuracy.update_one(
            {"_id": sig["_id"]},
            {"$set": {"exit_price": exit_price, "pnl_pct": pnl_pct, "correct": correct, "checked": True}}
        )
