"""
MiroFish Space Dungeon Swarm System
- 24 autonomous robot agents with unique personalities, roles, and memories
- Debate engine for swarm market reasoning
- Prediction from aggregated swarm votes
- Rollout stage management (shadow → canary → phase1 → phase2 → full)
"""
import random
import json
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

# ============== AGENT GENERATION ==============

def generate_agents():
    global agents_cache
    if agents_cache:
        # Update dynamic fields only
        for a in agents_cache:
            a["energy"] = min(100, max(20, a["energy"] + random.randint(-5, 8)))
            a["status"] = random.choice(STATUSES) if random.random() < 0.3 else a["status"]
            a["sector"] = random.choice(SECTORS) if random.random() < 0.15 else a["sector"]
            # Position drift for 3D visualization
            a["position"]["x"] += random.uniform(-0.5, 0.5)
            a["position"]["y"] += random.uniform(-0.3, 0.3)
            a["position"]["z"] += random.uniform(-0.5, 0.5)
            a["position"]["x"] = max(-10, min(10, a["position"]["x"]))
            a["position"]["y"] = max(-5, min(5, a["position"]["y"]))
            a["position"]["z"] = max(-10, min(10, a["position"]["z"]))
        return agents_cache

    agents = []
    for i in range(SWARM_AGENT_COUNT):
        agent_id = f"bot_{i+1:03d}"
        role = ROLES[i % len(ROLES)]
        personality = PERSONALITIES[i % len(PERSONALITIES)]
        color = AGENT_COLORS[i % len(AGENT_COLORS)]
        sector = SECTORS[i % len(SECTORS)]

        memories = [
            f"Watched BTC volatility cycle {i % 5}",
            f"Prefers {role.lower()} style decisions",
            f"Personality bias: {personality}",
            f"Last sector assignment: {sector}",
            random.choice([
                "Noticed divergence between RSI and price action",
                "Observed whale accumulation patterns",
                "Tracked funding rate anomalies",
                "Studied liquidation cascade triggers",
                "Analyzed order book depth imbalances",
                "Monitored social sentiment spikes",
            ])
        ]

        agents.append({
            "agent_id": agent_id,
            "name": f"{role.split()[0]}-{i+1:02d}",
            "role": role,
            "personality": personality,
            "color": color,
            "energy": random.randint(60, 100),
            "status": random.choice(STATUSES),
            "sector": sector,
            "memory": memories,
            "win_rate": round(random.uniform(0.42, 0.72), 2),
            "total_predictions": random.randint(50, 300),
            "position": {
                "x": random.uniform(-8, 8),
                "y": random.uniform(-3, 3),
                "z": random.uniform(-8, 8),
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    agents_cache = agents
    return agents


def get_agent(agent_id: str):
    agents = generate_agents()
    for a in agents:
        if a["agent_id"] == agent_id:
            return a
    return None


# ============== DEBATE ENGINE ==============

def run_debate(symbol: str = "BTCUSDT", timeframe: str = "15m"):
    agents = generate_agents()
    debaters = random.sample(agents, min(12, len(agents)))
    stances = []

    for a in debaters:
        bias = _personality_bias(a["personality"])
        confidence = round(random.uniform(0.45, 0.92), 2)

        # Role-based reasoning
        rationale = _generate_rationale(a, symbol, timeframe, bias)

        stances.append({
            "agent_id": a["agent_id"],
            "name": a["name"],
            "role": a["role"],
            "personality": a["personality"],
            "color": a["color"],
            "bias": bias,
            "confidence": confidence,
            "rationale": rationale,
        })

    debate_entry = {
        "symbol": symbol,
        "timeframe": timeframe,
        "stances": stances,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    debate_log.appendleft(debate_entry)
    return stances


def _personality_bias(personality: str) -> str:
    weights = {
        "aggressive": {"bullish": 0.55, "bearish": 0.25, "neutral": 0.20},
        "cautious": {"bullish": 0.25, "bearish": 0.35, "neutral": 0.40},
        "curious": {"bullish": 0.35, "bearish": 0.30, "neutral": 0.35},
        "skeptical": {"bullish": 0.20, "bearish": 0.45, "neutral": 0.35},
        "disciplined": {"bullish": 0.33, "bearish": 0.33, "neutral": 0.34},
        "chaotic-good": {"bullish": 0.40, "bearish": 0.40, "neutral": 0.20},
    }
    w = weights.get(personality, {"bullish": 0.33, "bearish": 0.33, "neutral": 0.34})
    return random.choices(list(w.keys()), weights=list(w.values()))[0]


def _generate_rationale(agent, symbol, timeframe, bias):
    templates = {
        "Scalper": [
            f"Quick momentum read on {symbol} {timeframe}: seeing {bias} micro-structure",
            f"Order flow delta tilting {bias} on {symbol} — typical scalp setup",
        ],
        "Risk Warden": [
            f"Risk assessment for {symbol}: volatility suggests {bias} exposure is {'acceptable' if bias != 'neutral' else 'safest'}",
            f"Drawdown limits check — {bias} stance aligns with risk parameters",
        ],
        "Trend Hunter": [
            f"Multi-TF trend analysis on {symbol}: {timeframe} shows {bias} continuation pattern",
            f"EMA ribbon on {symbol} confirms {bias} directional bias",
        ],
        "Sentiment Miner": [
            f"Social feeds and funding rates suggest {bias} sentiment for {symbol}",
            f"Crowd psychology indicators pointing {bias} on {symbol} {timeframe}",
        ],
        "Breakout Scout": [
            f"Compression zone detected on {symbol} {timeframe}: {bias} breakout imminent",
            f"Volume profile suggests {bias} breakout from current range",
        ],
        "Orderflow Mechanic": [
            f"Institutional order flow on {symbol} skewing {bias} — whale footprint detected",
            f"Bid/ask imbalance on {symbol}: {bias} pressure building",
        ],
    }
    options = templates.get(agent["role"], [f"{agent['role']} sees {bias} on {symbol}"])
    return random.choice(options)


# ============== PREDICTION ==============

def aggregate_prediction(symbol: str = "BTCUSDT", timeframe: str = "15m"):
    debate = run_debate(symbol, timeframe)
    bull = sum(x["confidence"] for x in debate if x["bias"] == "bullish")
    bear = sum(x["confidence"] for x in debate if x["bias"] == "bearish")
    neutral = sum(x["confidence"] for x in debate if x["bias"] == "neutral")
    total_score = bull + bear + neutral

    if bull > bear and bull > neutral:
        direction = "long_bias"
        confidence = round(bull / max(total_score, 1e-9), 3)
    elif bear > bull and bear > neutral:
        direction = "short_bias"
        confidence = round(bear / max(total_score, 1e-9), 3)
    else:
        direction = "wait"
        confidence = round(neutral / max(total_score, 1e-9), 3)

    result = {
        "symbol": symbol,
        "timeframe": timeframe,
        "direction": direction,
        "confidence": confidence,
        "votes": {
            "bullish_score": round(bull, 3),
            "bearish_score": round(bear, 3),
            "neutral_score": round(neutral, 3),
            "bullish_count": sum(1 for x in debate if x["bias"] == "bullish"),
            "bearish_count": sum(1 for x in debate if x["bias"] == "bearish"),
            "neutral_count": sum(1 for x in debate if x["bias"] == "neutral"),
        },
        "debate": debate,
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
    updates = {"anomaly_count": rollout_state["anomaly_count"] + 1, "reason": message, "blocked": True, "enabled": False}
    return set_rollout_state(**updates)

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
