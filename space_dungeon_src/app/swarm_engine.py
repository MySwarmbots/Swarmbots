import json
import random
from app.db import get_conn
from app.config import settings

ROLES = ["Scalper", "Risk Warden", "Trend Hunter", "Sentiment Miner", "Breakout Scout", "Orderflow Mechanic"]
PERSONALITIES = ["aggressive", "cautious", "curious", "skeptical", "disciplined", "chaotic-good"]

def seed_agents():
    conn = get_conn()
    cur = conn.cursor()
    count = cur.execute("SELECT COUNT(*) FROM swarm_memory").fetchone()[0]
    if count >= settings.swarm_agent_count:
        conn.close()
        return
    for i in range(settings.swarm_agent_count):
        agent_id = f"bot_{i+1:03d}"
        role = ROLES[i % len(ROLES)]
        personality = PERSONALITIES[i % len(PERSONALITIES)]
        memory = json.dumps([
            f"Watched BTC volatility cycle {i%5}",
            f"Prefers {role.lower()} style decisions",
            f"Personality bias: {personality}"
        ])
        cur.execute(
            "INSERT OR REPLACE INTO swarm_memory (agent_id, memory, personality, role) VALUES (?, ?, ?, ?)",
            (agent_id, memory, personality, role)
        )
    conn.commit()
    conn.close()

def list_agents():
    seed_agents()
    conn = get_conn()
    cur = conn.cursor()
    rows = cur.execute("SELECT agent_id, memory, personality, role FROM swarm_memory ORDER BY agent_id").fetchall()
    conn.close()
    agents = []
    for agent_id, memory, personality, role in rows:
        agents.append({
            "agent_id": agent_id,
            "memory": json.loads(memory),
            "personality": personality,
            "role": role,
            "energy": random.randint(60, 100),
            "status": random.choice(["patrolling", "debating", "backtesting", "routing", "resting"]),
            "sector": random.choice(["Vault-1", "Forge-2", "Bridge-3", "Signal-Spire", "Risk-Crypt"]),
        })
    return agents

def run_debate(symbol: str = "BTCUSDT", timeframe: str = "15m"):
    agents = list_agents()
    stances = []
    for a in agents[:12]:
        bias = random.choice(["bullish", "bearish", "neutral"])
        confidence = round(random.uniform(0.45, 0.92), 2)
        rationale = f"{a['role']} with {a['personality']} bias sees {bias} structure on {symbol} {timeframe}."
        stances.append({
            "agent_id": a["agent_id"],
            "bias": bias,
            "confidence": confidence,
            "rationale": rationale
        })
    return stances

def aggregate_prediction(symbol: str = "BTCUSDT", timeframe: str = "15m"):
    debate = run_debate(symbol, timeframe)
    bull = sum(x["confidence"] for x in debate if x["bias"] == "bullish")
    bear = sum(x["confidence"] for x in debate if x["bias"] == "bearish")
    neutral = sum(x["confidence"] for x in debate if x["bias"] == "neutral")
    if bull > bear and bull > neutral:
        direction = "long_bias"
        confidence = round(bull / max(bull + bear + neutral, 1e-9), 3)
    elif bear > bull and bear > neutral:
        direction = "short_bias"
        confidence = round(bear / max(bull + bear + neutral, 1e-9), 3)
    else:
        direction = "wait"
        confidence = round(neutral / max(bull + bear + neutral, 1e-9), 3)
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "direction": direction,
        "confidence": confidence,
        "votes": {
            "bullish_score": round(bull, 3),
            "bearish_score": round(bear, 3),
            "neutral_score": round(neutral, 3),
        },
        "debate": debate
    }
