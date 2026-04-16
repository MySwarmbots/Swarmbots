from app.models import SignalSnapshot, DetectorSignal, CorePrediction
from app.config import settings

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
        out.append(DetectorSignal(detector="rsi_reversal", action="buy", score=clamp(0.55 + (32 - s.rsi)/40), reason="oversold"))
    elif s.rsi >= 68:
        out.append(DetectorSignal(detector="rsi_reversal", action="sell", score=clamp(0.55 + (s.rsi - 68)/40), reason="overbought"))
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
    width = (s.channel_upper - s.channel_lower) / max(s.price, 1e-9)
    if s.atr_pct < 0.006:
        return "low_vol"
    if s.atr_pct > 0.018:
        return "high_vol"
    if width > 0.02:
        return "breakout"
    return "trend"

def adaptive_threshold(regime, disagreement=0.0):
    base = settings.base_confidence_threshold
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

def build_prediction(s: SignalSnapshot):
    signals = sorted(detect(s), key=lambda x: x.score, reverse=True)[:settings.top_signal_count]
    votes = {"buy":0.0,"sell":0.0,"hold":0.0}
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
        symbol=s.symbol,
        timeframe=s.timeframe,
        selected_action=action,
        confidence=confidence,
        disagreement=round(1.0 - confidence, 4),
        regime=regime,
        threshold_used=threshold,
        position_multiplier=position_multiplier(confidence, s.atr_pct),
        top_signals=signals,
    )
