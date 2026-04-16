import json
from datetime import datetime, timezone
from app.db import get_conn
from app.config import settings

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def gate_state():
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT mode, blocked, reason FROM rollout_gates WHERE id = 1").fetchone()
    conn.close()
    return {"mode": row[0], "blocked": bool(row[1]), "reason": row[2]} if row else {"mode": "shadow", "blocked": False, "reason": ""}

def set_gate(mode: str, blocked: bool, reason: str = ""):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE rollout_gates SET mode = ?, blocked = ?, reason = ? WHERE id = 1", (mode, int(blocked), reason))
    conn.commit()
    conn.close()
    return gate_state()

def validate_fill(symbol: str, exchange: str, expected_price: float, actual_price: float, expected_fee_bps: float, actual_fee_bps: float):
    drift_pct = abs(actual_price - expected_price) / max(expected_price, 1e-9) * 100.0
    slippage_bps = abs(actual_price - expected_price) / max(expected_price, 1e-9) * 10000.0
    reasons = []
    passed = True
    if slippage_bps > settings.max_allowed_slippage_bps:
        passed = False
        reasons.append("slippage_exceeded")
    if actual_fee_bps > settings.max_allowed_fee_bps:
        passed = False
        reasons.append("fee_exceeded")
    if drift_pct > settings.max_recon_drift_pct:
        passed = False
        reasons.append("recon_drift_exceeded")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO validation_runs (ts, symbol, exchange, mode, expected_price, actual_price, expected_fee_bps, actual_fee_bps, drift_pct, slippage_bps, passed, reasons) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (now_iso(), symbol, exchange, gate_state()['mode'], expected_price, actual_price, expected_fee_bps, actual_fee_bps, drift_pct, slippage_bps, int(passed), json.dumps(reasons))
    )
    conn.commit()
    conn.close()
    if not passed:
        set_gate(gate_state()["mode"], True, ",".join(reasons))
    return {
        "symbol": symbol,
        "exchange": exchange,
        "drift_pct": round(drift_pct, 4),
        "slippage_bps": round(slippage_bps, 4),
        "passed": passed,
        "reasons": reasons,
        "gate": gate_state(),
    }

def list_runs(limit=100):
    conn = get_conn()
    cur = conn.cursor()
    rows = cur.execute("SELECT ts, symbol, exchange, mode, expected_price, actual_price, expected_fee_bps, actual_fee_bps, drift_pct, slippage_bps, passed, reasons FROM validation_runs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    out = []
    for r in rows:
        out.append({
            "ts": r[0], "symbol": r[1], "exchange": r[2], "mode": r[3],
            "expected_price": r[4], "actual_price": r[5], "expected_fee_bps": r[6], "actual_fee_bps": r[7],
            "drift_pct": r[8], "slippage_bps": r[9], "passed": bool(r[10]), "reasons": r[11]
        })
    return out

def validation_summary():
    runs = list_runs(200)
    total = len(runs)
    passed = sum(1 for r in runs if r["passed"])
    failed = total - passed
    return {"total_runs": total, "passed": passed, "failed": failed, "gate": gate_state()}
