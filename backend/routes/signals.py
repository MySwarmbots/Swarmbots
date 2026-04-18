"""Signal accuracy + Signal Intelligence routes."""
import asyncio

from fastapi import APIRouter

from server import db, check_pending_signals

router = APIRouter()

@router.get("/signals/accuracy")
async def get_signal_accuracy(limit: int = 100):
    """Return signal accuracy history and aggregate stats."""
    # Run check in background — don't block the response
    asyncio.create_task(check_pending_signals())

    signals = await db.signal_accuracy.find(
        {"checked": True}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    total = len(signals)
    correct_count = sum(1 for s in signals if s.get("correct") is True)
    win_rate = round(correct_count / total * 100, 1) if total > 0 else 0
    avg_pnl = round(sum(s.get("pnl_pct", 0) for s in signals) / total, 3) if total > 0 else 0
    total_pnl = round(sum(s.get("pnl_pct", 0) for s in signals), 3)

    # Per-symbol breakdown
    by_symbol = {}
    for s in signals:
        sym = s["symbol"]
        if sym not in by_symbol:
            by_symbol[sym] = {"total": 0, "correct": 0, "pnl": 0}
        by_symbol[sym]["total"] += 1
        if s.get("correct"):
            by_symbol[sym]["correct"] += 1
        by_symbol[sym]["pnl"] += s.get("pnl_pct", 0)

    symbol_stats = [
        {"symbol": k, "total": v["total"], "correct": v["correct"],
         "win_rate": round(v["correct"] / v["total"] * 100, 1) if v["total"] else 0,
         "total_pnl": round(v["pnl"], 3)}
        for k, v in by_symbol.items()
    ]

    # Per-direction breakdown
    by_direction = {}
    for s in signals:
        d = s["direction"]
        if d not in by_direction:
            by_direction[d] = {"total": 0, "correct": 0, "pnl": 0}
        by_direction[d]["total"] += 1
        if s.get("correct"):
            by_direction[d]["correct"] += 1
        by_direction[d]["pnl"] += s.get("pnl_pct", 0)

    direction_stats = [
        {"direction": k, "total": v["total"], "correct": v["correct"],
         "win_rate": round(v["correct"] / v["total"] * 100, 1) if v["total"] else 0,
         "total_pnl": round(v["pnl"], 3)}
        for k, v in by_direction.items()
    ]

    pending_count = await db.signal_accuracy.count_documents({"checked": False})

    return {
        "total_signals": total,
        "correct": correct_count,
        "win_rate": win_rate,
        "avg_pnl_pct": avg_pnl,
        "total_pnl_pct": total_pnl,
        "pending": pending_count,
        "by_symbol": symbol_stats,
        "by_direction": direction_stats,
        "signals": signals,
    }


@router.get("/signals/pending")
async def get_pending_signals():
    pending = await db.signal_accuracy.find({"checked": False}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"pending": pending}

@router.get("/signals/intelligence")
async def get_signal_intelligence():
    """Return per-symbol, per-direction intelligence data for the dashboard."""
    pipeline = [
        {"$match": {"checked": True}},
        {"$group": {
            "_id": {"symbol": "$symbol", "direction": "$direction"},
            "total": {"$sum": 1},
            "correct": {"$sum": {"$cond": [{"$eq": ["$correct", True]}, 1, 0]}},
            "total_pnl": {"$sum": "$pnl_pct"},
            "avg_pnl": {"$avg": "$pnl_pct"},
        }},
        {"$sort": {"_id.symbol": 1}}
    ]
    results = await db.signal_accuracy.aggregate(pipeline).to_list(100)
    intel = []
    for r in results:
        wr = round(r["correct"] / r["total"] * 100, 1) if r["total"] > 0 else 0
        direction = r["_id"]["direction"]
        boost = "boost" if wr >= 80 else "penalize" if wr <= 30 else "neutral"
        intel.append({
            "symbol": r["_id"]["symbol"],
            "direction": direction,
            "direction_label": {"long_bias": "LONG", "short_bias": "SHORT", "wait": "WAIT"}.get(direction, direction),
            "total": r["total"],
            "correct": r["correct"],
            "win_rate": wr,
            "total_pnl": round(r["total_pnl"], 3),
            "avg_pnl": round(r["avg_pnl"], 4),
            "action": boost,
        })
    return {"intelligence": intel}
