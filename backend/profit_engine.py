"""
MiroFish Profit-Optimized Engine
- Adaptive confidence thresholds
- Market regime filter
- Higher timeframe confirmation
- Volatility-aware position sizing
- Cooldown protection
- Backtest
"""
from collections import deque
from typing import Literal

from pydantic import BaseModel, Field

# ============== MODELS ==============

Action = Literal["buy", "sell", "hold"]

class SignalSnapshot(BaseModel):
    symbol: str
    timeframe: str = "5m"
    price: float
    ema_fast: float
    ema_slow: float
    rsi: float
    vwap: float
    channel_upper: float
    channel_lower: float
    atr_pct: float = 0.01
    higher_tf_bias: Action = "hold"
    timestamp: str | None = None

class DetectorSignal(BaseModel):
    detector: str
    action: Action
    score: float = Field(ge=0, le=1)
    reason: str

class CorePrediction(BaseModel):
    symbol: str
    timeframe: str
    selected_action: Action
    confidence: float = Field(ge=0, le=1)
    disagreement: float = Field(ge=0, le=1)
    regime: str
    threshold_used: float = Field(ge=0, le=1)
    position_multiplier: float
    top_signals: list[DetectorSignal]

class TradingViewWebhook(BaseModel):
    secret: str
    ticker: str
    action: Action
    price: float
    interval: str = "5m"
    time: str
    id: str | None = None
    position_size: float = 100.0

# ============== IN-MEMORY STATE ==============

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

# ============== ENGINE CONFIG ==============

BASE_CONFIDENCE_THRESHOLD = 0.68
TOP_SIGNAL_COUNT = 10
MAX_POSITION_NOTIONAL_USD = 500.0
MAX_DAILY_LOSS_USD = 250.0
KILL_SWITCH = "OFF"
COOLDOWN_BARS = 2

def update_config(config: dict):
    global BASE_CONFIDENCE_THRESHOLD, TOP_SIGNAL_COUNT, MAX_POSITION_NOTIONAL_USD, MAX_DAILY_LOSS_USD, KILL_SWITCH, COOLDOWN_BARS
    BASE_CONFIDENCE_THRESHOLD = config.get("base_confidence_threshold", BASE_CONFIDENCE_THRESHOLD)
    TOP_SIGNAL_COUNT = config.get("top_signal_count", TOP_SIGNAL_COUNT)
    MAX_POSITION_NOTIONAL_USD = config.get("max_position_notional_usd", MAX_POSITION_NOTIONAL_USD)
    MAX_DAILY_LOSS_USD = config.get("max_daily_loss_usd", MAX_DAILY_LOSS_USD)
    KILL_SWITCH = config.get("kill_switch", KILL_SWITCH)
    COOLDOWN_BARS = config.get("cooldown_bars", COOLDOWN_BARS)

# ============== CORE ENGINE ==============

def clamp(v):
    return max(0.0, min(1.0, v))

def detect(s: SignalSnapshot):
    out = []
    if s.price <= s.channel_lower * 1.01:
        out.append(DetectorSignal(detector="channel", action="buy", score=0.72, reason="near_lower_channel"))
    elif s.price >= s.channel_upper * 0.99:
        out.append(DetectorSignal(detector="channel", action="sell", score=0.72, reason="near_upper_channel"))
    else:
        out.append(DetectorSignal(detector="channel", action="hold", score=0.35, reason="mid_channel"))

    if s.rsi <= 32:
        out.append(DetectorSignal(detector="rsi_reversal", action="buy", score=clamp(0.55 + (32 - s.rsi) / 40), reason="oversold"))
    elif s.rsi >= 68:
        out.append(DetectorSignal(detector="rsi_reversal", action="sell", score=clamp(0.55 + (s.rsi - 68) / 40), reason="overbought"))
    else:
        out.append(DetectorSignal(detector="rsi_reversal", action="hold", score=0.30, reason="neutral"))

    if s.ema_fast > s.ema_slow:
        out.append(DetectorSignal(detector="ema_crossover", action="buy", score=0.66, reason="fast_above_slow"))
    elif s.ema_fast < s.ema_slow:
        out.append(DetectorSignal(detector="ema_crossover", action="sell", score=0.66, reason="fast_below_slow"))
    else:
        out.append(DetectorSignal(detector="ema_crossover", action="hold", score=0.33, reason="flat"))

    if s.price > s.vwap:
        out.append(DetectorSignal(detector="vwap_momentum", action="buy", score=0.61, reason="above_vwap"))
    elif s.price < s.vwap:
        out.append(DetectorSignal(detector="vwap_momentum", action="sell", score=0.61, reason="below_vwap"))
    else:
        out.append(DetectorSignal(detector="vwap_momentum", action="hold", score=0.34, reason="at_vwap"))
    return out

def classify_regime(s: SignalSnapshot):
    if s.atr_pct < 0.006:
        return "low_vol"
    if s.atr_pct > 0.018:
        return "high_vol"
    width = (s.channel_upper - s.channel_lower) / max(s.price, 1e-9)
    if width > 0.02:
        return "breakout"
    return "trend"

def adaptive_threshold(regime, disagreement=0.0):
    base = BASE_CONFIDENCE_THRESHOLD
    if regime == "trend":
        base -= 0.03
    elif regime == "high_vol":
        base += 0.04
    elif regime == "low_vol":
        base += 0.02
    return clamp(base + disagreement * 0.05)

def position_multiplier(confidence, atr_pct):
    vol_penalty = min(max(atr_pct / 0.02, 0.3), 1.5)
    raw = confidence / max(vol_penalty, 0.3)
    return round(min(max(raw, 0.0), 1.5), 3)

def build_prediction(s: SignalSnapshot) -> CorePrediction:
    signals = sorted(detect(s), key=lambda x: x.score, reverse=True)[:TOP_SIGNAL_COUNT]
    votes = {"buy": 0.0, "sell": 0.0, "hold": 0.0}
    for sig in signals:
        votes[sig.action] += sig.score
    total = max(sum(votes.values()), 1e-9)
    action = max(votes, key=votes.get)
    confidence = round(votes[action] / total, 4)
    regime = classify_regime(s)
    threshold = adaptive_threshold(regime, 1.0 - confidence)

    if s.higher_tf_bias != "hold" and action != s.higher_tf_bias:
        confidence = round(max(confidence - 0.12, 0.0), 4)
    if regime == "high_vol" and action != "hold":
        confidence = round(max(confidence - 0.05, 0.0), 4)
    if regime == "trend" and action == s.higher_tf_bias and action != "hold":
        confidence = round(min(confidence + 0.05, 1.0), 4)

    return CorePrediction(
        symbol=s.symbol, timeframe=s.timeframe, selected_action=action,
        confidence=confidence, disagreement=round(1.0 - confidence, 4),
        regime=regime, threshold_used=threshold,
        position_multiplier=position_multiplier(confidence, s.atr_pct),
        top_signals=signals,
    )

# ============== RISK ==============

def check_risk(symbol, notional_usd):
    if KILL_SWITCH.upper() == "ON":
        return False, "kill_switch"
    if realized_pnl_usd <= -abs(MAX_DAILY_LOSS_USD):
        return False, "max_daily_loss"
    if notional_usd > MAX_POSITION_NOTIONAL_USD:
        return False, "max_position_notional"
    if cooldowns.get(symbol, 0) > 0:
        return False, "cooldown_active"
    return True, "ok"

# ============== WEBHOOK PROCESSING ==============

def snapshot_from_webhook(p: TradingViewWebhook) -> SignalSnapshot:
    price = p.price
    bias = "buy" if p.action == "buy" else "sell" if p.action == "sell" else "hold"
    return SignalSnapshot(
        symbol=p.ticker, timeframe=p.interval, price=price,
        ema_fast=price * (1.002 if p.action == "buy" else 0.998 if p.action == "sell" else 1.0),
        ema_slow=price,
        rsi=28 if p.action == "buy" else 72 if p.action == "sell" else 50,
        vwap=price * (0.998 if p.action == "buy" else 1.002 if p.action == "sell" else 1.0),
        channel_upper=price * 1.01, channel_lower=price * 0.99,
        atr_pct=0.008 if p.interval == "5m" else 0.012,
        higher_tf_bias=bias, timestamp=p.time,
    )

def process_webhook(payload: TradingViewWebhook):
    global realized_pnl_usd

    for k in list(cooldowns.keys()):
        cooldowns[k] = max(cooldowns[k] - 1, 0)

    pred = build_prediction(snapshot_from_webhook(payload))
    buy_votes = sum(1 for s in pred.top_signals if s.action == "buy")
    sell_votes = sum(1 for s in pred.top_signals if s.action == "sell")
    hold_votes = sum(1 for s in pred.top_signals if s.action == "hold")
    total = max(len(pred.top_signals), 1)

    optimizer_state["adaptive_threshold"] = pred.threshold_used
    optimizer_state["market_regime"] = pred.regime
    optimizer_state["last_decision"] = pred.selected_action

    swarm_state["symbol"] = pred.symbol
    swarm_state["timeframe"] = pred.timeframe
    swarm_state["vote_counts"] = {"buy": buy_votes, "sell": sell_votes, "hold": hold_votes}
    swarm_state["bias_split"] = {"buy": round(buy_votes / total, 3), "sell": round(sell_votes / total, 3), "hold": round(hold_votes / total, 3)}
    swarm_state["consensus"] = {"action": pred.selected_action, "consensus_score": pred.confidence, "disagreement_score": pred.disagreement}
    swarm_state["latest_prediction"] = pred.model_dump()
    prediction_log.appendleft(pred.model_dump())

    if pred.selected_action == "hold" or pred.confidence < pred.threshold_used:
        return {"status": "no_trade", "prediction": pred.model_dump()}

    notional = round(payload.position_size * max(pred.position_multiplier, 0.25), 2)
    ok, reason = check_risk(payload.ticker, notional)
    if not ok:
        return {"status": "blocked", "reason": reason, "prediction": pred.model_dump()}

    qty = round(notional / max(payload.price, 0.0001), 6)
    position = {"symbol": payload.ticker, "side": "long" if pred.selected_action == "buy" else "short", "quantity": qty, "entry_price": payload.price, "notional_usd": notional}
    positions[payload.ticker] = position
    order_log.appendleft({"symbol": payload.ticker, "side": pred.selected_action, "quantity": qty, "status": "paper_fill"})
    trade_log.appendleft({"symbol": payload.ticker, "side": pred.selected_action, "price": payload.price, "quantity": qty, "regime": pred.regime, "threshold": pred.threshold_used})
    cooldowns[payload.ticker] = COOLDOWN_BARS
    return {"status": "executed", "prediction": pred.model_dump(), "position": position}

# ============== BACKTEST ==============

def run_backtest(snapshots: list[SignalSnapshot]):
    trades = []
    total = 0.0
    for i, snap in enumerate(snapshots[:-1]):
        pred = build_prediction(snap)
        if pred.selected_action == "hold" or pred.confidence < pred.threshold_used:
            continue
        nxt = snapshots[i + 1]
        pnl = ((nxt.price - snap.price) / snap.price) * 100 if pred.selected_action == "buy" else ((snap.price - nxt.price) / snap.price) * 100
        pnl = round(pnl, 4)
        trades.append({"action": pred.selected_action, "entry": snap.price, "exit": nxt.price, "pnl_pct": pnl})
        total += pnl
    win_rate = round((sum(1 for t in trades if t["pnl_pct"] > 0) / len(trades)) if trades else 0.0, 4)
    avg_trade = round((total / len(trades)) if trades else 0.0, 4)
    return {"trades": trades, "total_return_pct": round(total, 4), "win_rate": win_rate, "avg_trade_pct": avg_trade}
