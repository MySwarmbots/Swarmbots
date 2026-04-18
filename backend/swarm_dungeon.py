"""
MiroFish Space Dungeon Swarm System
- 24 autonomous robot agents with unique personalities, roles, and memories
- Debate engine for swarm market reasoning
- Prediction from aggregated swarm votes
- Rollout stage management (shadow -> canary -> phase1 -> phase2 -> full)
"""
import secrets
import random
from datetime import datetime, timezone
from typing import Optional
from collections import deque

# ============== AGENT CONFIG ==============

ROLES = ["Scalper", "Risk Warden", "Trend Hunter", "Sentiment Miner", "Breakout Scout", "Orderflow Mechanic"]
PERSONALITIES = ["aggressive", "cautious", "curious", "skeptical", "disciplined", "chaotic-good"]
SECTORS = ["Vault-1", "Forge-2", "Bridge-3", "Signal-Spire", "Risk-Crypt", "Data-Nexus"]
STATUSES = ["patrolling", "debating", "backtesting", "routing", "resting", "mining-data", "analyzing"]
AGENT_COLORS = ["#00FF66", "#FF3B30", "#FFCC00", "#002FA7", "#FF6B00", "#00BFFF", "#FF00FF", "#00FFAA"]

SWARM_AGENT_COUNT = 24
ROLLOUT_STAGES = ["shadow", "canary", "phase1", "phase2", "full"]

MEMORY_OPTIONS = [
    "Noticed divergence between RSI and price action",
    "Observed whale accumulation patterns",
    "Tracked funding rate anomalies",
    "Studied liquidation cascade triggers",
    "Analyzed order book depth imbalances",
    "Monitored social sentiment spikes",
]

PERSONALITY_WEIGHTS = {
    "aggressive": {"bullish": 0.55, "bearish": 0.25, "neutral": 0.20},
    "cautious": {"bullish": 0.25, "bearish": 0.35, "neutral": 0.40},
    "curious": {"bullish": 0.35, "bearish": 0.30, "neutral": 0.35},
    "skeptical": {"bullish": 0.20, "bearish": 0.45, "neutral": 0.35},
    "disciplined": {"bullish": 0.33, "bearish": 0.33, "neutral": 0.34},
    "chaotic-good": {"bullish": 0.40, "bearish": 0.40, "neutral": 0.20},
}

RATIONALE_TEMPLATES = {
    "Scalper": [
        "Quick momentum read on {sym} {tf}: seeing {bias} micro-structure",
        "Order flow delta tilting {bias} on {sym} — typical scalp setup",
    ],
    "Risk Warden": [
        "Risk assessment for {sym}: volatility suggests {bias} exposure is {risk_note}",
        "Drawdown limits check — {bias} stance aligns with risk parameters",
    ],
    "Trend Hunter": [
        "Multi-TF trend analysis on {sym}: {tf} shows {bias} continuation pattern",
        "EMA ribbon on {sym} confirms {bias} directional bias",
    ],
    "Sentiment Miner": [
        "Social feeds and funding rates suggest {bias} sentiment for {sym}",
        "Crowd psychology indicators pointing {bias} on {sym} {tf}",
    ],
    "Breakout Scout": [
        "Compression zone detected on {sym} {tf}: {bias} breakout imminent",
        "Volume profile suggests {bias} breakout from current range",
    ],
    "Orderflow Mechanic": [
        "Institutional order flow on {sym} skewing {bias} — whale footprint detected",
        "Bid/ask imbalance on {sym}: {bias} pressure building",
    ],
}

# ============== IN-MEMORY STATE ==============

agents_cache = []
debate_log = deque(maxlen=50)
prediction_log = deque(maxlen=100)

rollout_state = {
    "stage": "shadow",
    "enabled": True,
    "blocked": False,
    "allocated_capital_usd": 0.0,
    "failed_validations": 0,
    "passed_validations": 0,
    "anomaly_count": 0,
    "reason": "",
}

rollout_audit = deque(maxlen=200)

STAGE_CAPITAL = {
    "shadow": 0.0,
    "canary": 100.0,
    "phase1": 300.0,
    "phase2": 750.0,
    "full": 1500.0,
}

# ============== HELPERS ==============


def _sec_randint(low, high):
    """Secure random integer in [low, high] inclusive."""
    return secrets.randbelow(high - low + 1) + low


def _sec_uniform(low, high):
    """Secure random float in [low, high)."""
    return low + (secrets.randbelow(10000) / 10000) * (high - low)


def _sec_choice(items):
    """Secure random choice from a list."""
    return secrets.choice(items)


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def _build_agent_memories(i, role, personality, sector):
    return [
        f"Watched BTC volatility cycle {i % 5}",
        f"Prefers {role.lower()} style decisions",
        f"Personality bias: {personality}",
        f"Last sector assignment: {sector}",
        _sec_choice(MEMORY_OPTIONS),
    ]


def _create_agent(i):
    role = ROLES[i % len(ROLES)]
    personality = PERSONALITIES[i % len(PERSONALITIES)]
    color = AGENT_COLORS[i % len(AGENT_COLORS)]
    sector = SECTORS[i % len(SECTORS)]

    return {
        "agent_id": f"bot_{i+1:03d}",
        "name": f"{role.split()[0]}-{i+1:02d}",
        "role": role,
        "personality": personality,
        "color": color,
        "energy": _sec_randint(60, 100),
        "status": _sec_choice(STATUSES),
        "sector": sector,
        "memory": _build_agent_memories(i, role, personality, sector),
        "win_rate": round(_sec_uniform(0.42, 0.72), 2),
        "total_predictions": _sec_randint(50, 300),
        "position": {
            "x": round(_sec_uniform(-8, 8), 2),
            "y": round(_sec_uniform(-3, 3), 2),
            "z": round(_sec_uniform(-8, 8), 2),
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def _update_agent_state(agent):
    """Update dynamic fields on an existing agent (energy, status, position drift)."""
    agent["energy"] = _clamp(agent["energy"] + _sec_randint(-5, 8), 20, 100)

    if _sec_uniform(0, 1) < 0.3:
        agent["status"] = _sec_choice(STATUSES)
    if _sec_uniform(0, 1) < 0.15:
        agent["sector"] = _sec_choice(SECTORS)

    agent["position"]["x"] = _clamp(agent["position"]["x"] + _sec_uniform(-0.5, 0.5), -10, 10)
    agent["position"]["y"] = _clamp(agent["position"]["y"] + _sec_uniform(-0.3, 0.3), -5, 5)
    agent["position"]["z"] = _clamp(agent["position"]["z"] + _sec_uniform(-0.5, 0.5), -10, 10)


# ============== AGENT GENERATION ==============

def generate_agents():
    global agents_cache
    if agents_cache:
        for agent in agents_cache:
            _update_agent_state(agent)
        return agents_cache

    agents_cache = [_create_agent(i) for i in range(SWARM_AGENT_COUNT)]
    return agents_cache


def get_agent(agent_id: str):
    for agent in generate_agents():
        if agent["agent_id"] == agent_id:
            return agent
    return None


# ============== DEBATE ENGINE ==============

def _personality_bias(personality: str) -> str:
    w = PERSONALITY_WEIGHTS.get(personality, {"bullish": 0.33, "bearish": 0.33, "neutral": 0.34})
    return random.choices(list(w.keys()), weights=list(w.values()))[0]


def _generate_rationale(agent, symbol, timeframe, bias):
    templates = RATIONALE_TEMPLATES.get(agent["role"], ["{bias} signal on {sym}"])
    template = _sec_choice(templates)
    risk_note = "acceptable" if bias != "neutral" else "safest"
    return template.format(sym=symbol, tf=timeframe, bias=bias, risk_note=risk_note)


def run_debate(symbol: str = "BTCUSDT", timeframe: str = "15m"):
    agents = generate_agents()
    debaters = random.sample(agents, min(12, len(agents)))
    stances = []

    for agent in debaters:
        bias = _personality_bias(agent["personality"])
        stances.append({
            "agent_id": agent["agent_id"],
            "name": agent["name"],
            "role": agent["role"],
            "personality": agent["personality"],
            "color": agent["color"],
            "bias": bias,
            "confidence": round(_sec_uniform(0.45, 0.92), 2),
            "rationale": _generate_rationale(agent, symbol, timeframe, bias),
        })

    debate_log.appendleft({
        "symbol": symbol, "timeframe": timeframe,
        "stances": stances, "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return stances


# ============== PREDICTION ==============

def _tally_votes(debate):
    bull = sum(x["confidence"] for x in debate if x["bias"] == "bullish")
    bear = sum(x["confidence"] for x in debate if x["bias"] == "bearish")
    neutral = sum(x["confidence"] for x in debate if x["bias"] == "neutral")
    return bull, bear, neutral


def _determine_direction(bull, bear, neutral):
    if bull > bear and bull > neutral:
        return "long_bias", bull
    if bear > bull and bear > neutral:
        return "short_bias", bear
    return "wait", neutral


def _count_votes(debate):
    return {
        "bullish_count": sum(1 for x in debate if x["bias"] == "bullish"),
        "bearish_count": sum(1 for x in debate if x["bias"] == "bearish"),
        "neutral_count": sum(1 for x in debate if x["bias"] == "neutral"),
    }


def aggregate_prediction(symbol: str = "BTCUSDT", timeframe: str = "15m"):
    debate = run_debate(symbol, timeframe)
    bull, bear, neutral = _tally_votes(debate)
    total_score = bull + bear + neutral

    direction, winning_score = _determine_direction(bull, bear, neutral)
    confidence = round(winning_score / max(total_score, 1e-9), 3)

    votes = {
        "bullish_score": round(bull, 3),
        "bearish_score": round(bear, 3),
        "neutral_score": round(neutral, 3),
        **_count_votes(debate),
    }

    result = {
        "symbol": symbol, "timeframe": timeframe,
        "direction": direction, "confidence": confidence,
        "votes": votes, "debate": debate,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    prediction_log.appendleft(result)
    return result


# ============== ROLLOUT ENGINE ==============

def get_rollout_state():
    return rollout_state.copy()

def rollout_summary():
    state = get_rollout_state()
    can, reason = can_promote()
    state["promotion_ready"] = can
    state["promotion_reason"] = reason
    return state

def set_rollout_state(**kwargs):
    before = rollout_state.get("stage", "unknown")
    rollout_state.update(kwargs)
    rollout_audit.appendleft({
        "ts": datetime.now(timezone.utc).isoformat(),
        "action": "state_update",
        "stage_before": before,
        "stage_after": rollout_state.get("stage", before),
        "message": rollout_state.get("reason", ""),
    })
    return get_rollout_state()

def initialize_capital():
    stage = rollout_state["stage"]
    return set_rollout_state(allocated_capital_usd=STAGE_CAPITAL.get(stage, 0))

def record_validation(passed: bool, reason: str = ""):
    failed = rollout_state["failed_validations"] + (0 if passed else 1)
    passed_ct = rollout_state["passed_validations"] + (1 if passed else 0)
    updates = {"failed_validations": failed, "passed_validations": passed_ct}
    if not passed and failed >= 3:
        updates.update({"blocked": True, "enabled": False, "reason": reason or "too_many_failed_validations"})
    return set_rollout_state(**updates)

def record_anomaly(message: str = "anomaly_detected"):
    return set_rollout_state(anomaly_count=rollout_state["anomaly_count"] + 1, reason=message, blocked=True, enabled=False)

def can_promote():
    if rollout_state["blocked"]:
        return False, "blocked"
    if rollout_state["passed_validations"] < 5:
        return False, "insufficient_passed_validations"
    if rollout_state["failed_validations"] >= 3:
        return False, "too_many_failed_validations"
    return True, "ok"

def promote():
    ok, reason = can_promote()
    if not ok:
        return {"promoted": False, "reason": reason, "state": get_rollout_state()}
    current = rollout_state["stage"]
    idx = ROLLOUT_STAGES.index(current) if current in ROLLOUT_STAGES else 0
    next_stage = ROLLOUT_STAGES[min(idx + 1, len(ROLLOUT_STAGES) - 1)]
    return {"promoted": True, "state": set_rollout_state(stage=next_stage, allocated_capital_usd=STAGE_CAPITAL.get(next_stage, 0), reason="promoted")}

def demote(reason: str = "manual_demote"):
    current = rollout_state["stage"]
    idx = ROLLOUT_STAGES.index(current) if current in ROLLOUT_STAGES else 0
    next_stage = ROLLOUT_STAGES[max(idx - 1, 0)]
    return {"demoted": True, "state": set_rollout_state(stage=next_stage, allocated_capital_usd=STAGE_CAPITAL.get(next_stage, 0), reason=reason)}

def set_stage(stage: str):
    if stage not in ROLLOUT_STAGES:
        return {"updated": False, "reason": "invalid_stage", "state": get_rollout_state()}
    return {"updated": True, "state": set_rollout_state(stage=stage, allocated_capital_usd=STAGE_CAPITAL.get(stage, 0), reason="manual_stage_set")}

def get_audit():
    return list(rollout_audit)
