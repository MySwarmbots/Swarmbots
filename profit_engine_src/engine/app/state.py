from collections import deque
positions = {}
realized_pnl_usd = 0.0
order_log = deque(maxlen=200)
trade_log = deque(maxlen=200)
prediction_log = deque(maxlen=100)
cooldowns = {}
optimizer_state = {
    "adaptive_threshold": 0.68,
    "market_regime": "neutral",
    "cooldown_bars": 2,
    "last_decision": "hold",
}
swarm_state = {
    "symbol": "BTCUSDT",
    "timeframe": "5m",
    "vote_counts": {"buy": 0, "sell": 0, "hold": 0},
    "bias_split": {"buy": 0.0, "sell": 0.0, "hold": 0.0},
    "consensus": {"action": "hold", "consensus_score": 0.0, "disagreement_score": 0.0},
    "latest_prediction": None,
    "optimizer_state": optimizer_state,
}
