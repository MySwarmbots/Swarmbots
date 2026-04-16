from fastapi import APIRouter
from app.models import SignalSnapshot
from app.core_engine import build_prediction
router = APIRouter()
@router.post("/run")
def run_backtest(snapshots: list[SignalSnapshot]):
    trades = []
    total = 0.0
    for i, snap in enumerate(snapshots[:-1]):
        pred = build_prediction(snap)
        if pred.selected_action == "hold" or pred.confidence < pred.threshold_used:
            continue
        nxt = snapshots[i+1]
        pnl = ((nxt.price - snap.price) / snap.price) * 100 if pred.selected_action == "buy" else ((snap.price - nxt.price) / snap.price) * 100
        pnl = round(pnl, 4)
        trades.append({"action": pred.selected_action, "entry": snap.price, "exit": nxt.price, "pnl_pct": pnl})
        total += pnl
    win_rate = round((sum(1 for t in trades if t["pnl_pct"] > 0) / len(trades)) if trades else 0.0, 4)
    avg_trade = round((total / len(trades)) if trades else 0.0, 4)
    return {"trades": trades, "total_return_pct": round(total,4), "win_rate": win_rate, "avg_trade_pct": avg_trade}
