from datetime import datetime, timezone
from app.db import get_conn
from app.config import settings

STAGE_ORDER = ["shadow", "canary", "phase1", "phase2", "full"]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def stage_capital(stage: str) -> float:
    return {
        "shadow": 0.0,
        "canary": settings.canary_capital_usd,
        "phase1": settings.phase1_capital_usd,
        "phase2": settings.phase2_capital_usd,
        "full": settings.full_capital_usd,
    }.get(stage, 0.0)

def get_state():
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT stage, enabled, blocked, allocated_capital_usd, failed_validations, passed_validations, anomaly_count, reason FROM rollout_state WHERE id = 1").fetchone()
    conn.close()
    if not row:
        return {}
    return {
        "stage": row[0],
        "enabled": bool(row[1]),
        "blocked": bool(row[2]),
        "allocated_capital_usd": row[3],
        "failed_validations": row[4],
        "passed_validations": row[5],
        "anomaly_count": row[6],
        "reason": row[7],
    }

def audit(action: str, before: str, after: str, message: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO rollout_audit (ts, action, stage_before, stage_after, message) VALUES (?, ?, ?, ?, ?)", (now_iso(), action, before, after, message))
    conn.commit()
    conn.close()

def set_state(**kwargs):
    state = get_state()
    before = state.get("stage", "unknown")
    state.update(kwargs)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE rollout_state SET stage=?, enabled=?, blocked=?, allocated_capital_usd=?, failed_validations=?, passed_validations=?, anomaly_count=?, reason=? WHERE id = 1",
        (
            state.get("stage", "shadow"),
            int(state.get("enabled", True)),
            int(state.get("blocked", False)),
            float(state.get("allocated_capital_usd", 0.0)),
            int(state.get("failed_validations", 0)),
            int(state.get("passed_validations", 0)),
            int(state.get("anomaly_count", 0)),
            state.get("reason", ""),
        ),
    )
    conn.commit()
    conn.close()
    audit("state_update", before, state.get("stage", before), state.get("reason", ""))
    return get_state()

def initialize_capital():
    state = get_state()
    return set_state(allocated_capital_usd=stage_capital(state["stage"]))

def record_validation(passed: bool, reason: str = ""):
    state = get_state()
    failed = state["failed_validations"] + (0 if passed else 1)
    passed_ct = state["passed_validations"] + (1 if passed else 0)
    updates = {"failed_validations": failed, "passed_validations": passed_ct}
    if (not passed) and settings.auto_disable_on_anomaly and failed >= settings.max_failed_validations:
        updates.update({"blocked": True, "enabled": False, "reason": reason or "too_many_failed_validations"})
    return set_state(**updates)

def record_anomaly(message: str = "anomaly_detected"):
    state = get_state()
    updates = {"anomaly_count": state["anomaly_count"] + 1, "reason": message}
    if settings.auto_disable_on_anomaly:
        updates.update({"blocked": True, "enabled": False})
    return set_state(**updates)

def can_promote():
    state = get_state()
    if state["blocked"]:
        return False, "blocked"
    if state["passed_validations"] < settings.min_passed_validations_to_promote:
        return False, "insufficient_passed_validations"
    if state["failed_validations"] >= settings.max_failed_validations:
        return False, "too_many_failed_validations"
    return True, "ok"

def promote():
    ok, reason = can_promote()
    state = get_state()
    if not ok:
        return {"promoted": False, "reason": reason, "state": state}
    current = state["stage"]
    idx = STAGE_ORDER.index(current) if current in STAGE_ORDER else 0
    next_stage = STAGE_ORDER[min(idx + 1, len(STAGE_ORDER)-1)]
    return {"promoted": True, "state": set_state(stage=next_stage, allocated_capital_usd=stage_capital(next_stage), reason="promoted")}

def demote(reason: str = "manual_demote"):
    state = get_state()
    current = state["stage"]
    idx = STAGE_ORDER.index(current) if current in STAGE_ORDER else 0
    next_stage = STAGE_ORDER[max(idx - 1, 0)]
    return {"demoted": True, "state": set_state(stage=next_stage, allocated_capital_usd=stage_capital(next_stage), reason=reason)}

def set_stage(stage: str):
    if stage not in STAGE_ORDER:
        return {"updated": False, "reason": "invalid_stage", "state": get_state()}
    return {"updated": True, "state": set_state(stage=stage, allocated_capital_usd=stage_capital(stage), reason="manual_stage_set")}

def list_audit(limit: int = 100):
    conn = get_conn()
    cur = conn.cursor()
    rows = cur.execute("SELECT ts, action, stage_before, stage_after, message FROM rollout_audit ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [{"ts": r[0], "action": r[1], "stage_before": r[2], "stage_after": r[3], "message": r[4]} for r in rows]

def rollout_summary():
    state = get_state()
    return {**state, "promotion_ready": can_promote()[0]}
