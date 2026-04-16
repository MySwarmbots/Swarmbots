from fastapi import APIRouter, HTTPException
from app.config import settings
from app.models import TradingViewWebhook, SignalSnapshot
from app.core_engine import build_prediction
from app.state import swarm_state, prediction_log, positions, order_log, trade_log, optimizer_state, cooldowns
from app.risk import check_risk

router = APIRouter()

def snapshot_from_webhook(p: TradingViewWebhook):
    price = p.price
    bias = "buy" if p.action == "buy" else "sell" if p.action == "sell" else "hold"
    return SignalSnapshot(
        symbol=p.ticker,
        timeframe=p.interval,
        price=price,
        ema_fast=price * (1.002 if p.action == "buy" else 0.998 if p.action == "sell" else 1.0),
        ema_slow=price,
        rsi=28 if p.action == "buy" else 72 if p.action == "sell" else 50,
        vwap=price * (0.998 if p.action == "buy" else 1.002 if p.action == "sell" else 1.0),
        channel_upper=price * 1.01,
        channel_lower=price * 0.99,
        atr_pct=0.008 if p.interval == "5m" else 0.012,
        higher_tf_bias=bias,
        timestamp=p.time,
    )

@router.post("/tradingview")
def tradingview_webhook(payload: TradingViewWebhook):
    if payload.secret != settings.webhook_secret:
        raise HTTPException(status_code=403, detail="invalid secret")

    for k in list(cooldowns.keys()):
        cooldowns[k] = max(cooldowns[k]-1, 0)

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
    swarm_state["bias_split"] = {"buy": round(buy_votes/total,3), "sell": round(sell_votes/total,3), "hold": round(hold_votes/total,3)}
    swarm_state["consensus"] = {"action": pred.selected_action, "consensus_score": pred.confidence, "disagreement_score": pred.disagreement}
    swarm_state["latest_prediction"] = pred.model_dump()
    prediction_log.appendleft(pred.model_dump())

    if pred.selected_action == "hold" or pred.confidence < pred.threshold_used:
        return {"status":"no_trade","prediction":pred.model_dump()}

    notional = round(payload.position_size * max(pred.position_multiplier, 0.25), 2)
    ok, reason = check_risk(payload.ticker, notional)
    if not ok:
        return {"status":"blocked","reason":reason,"prediction":pred.model_dump()}

    qty = round(notional / max(payload.price, 0.0001), 6)
    position = {"symbol": payload.ticker, "side": "long" if pred.selected_action == "buy" else "short", "quantity": qty, "entry_price": payload.price, "notional_usd": notional}
    positions[payload.ticker] = position
    order_log.appendleft({"symbol": payload.ticker, "side": pred.selected_action, "quantity": qty, "status": "paper_fill"})
    trade_log.appendleft({"symbol": payload.ticker, "side": pred.selected_action, "price": payload.price, "quantity": qty, "regime": pred.regime, "threshold": pred.threshold_used})
    cooldowns[payload.ticker] = settings.cooldown_bars
    return {"status":"executed","prediction":pred.model_dump(),"position":position}
