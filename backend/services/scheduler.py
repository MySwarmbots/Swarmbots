"""
Scheduler service.
Runs the swarm-prediction loop on a configurable interval (default 5 min)
for every symbol in the auto-exec config. For each prediction it:
  1. Applies signal-intelligence adjustments (via auto_exec service)
  2. Broadcasts over WebSocket to connected clients
  3. Records the run in `scheduler_runs`
  4. Snapshots entry price in `signal_accuracy` for later WR calc
  5. Fans out a Telegram alert to opted-in users
  6. Fires auto-exec on Bitget if enabled
"""
import asyncio
from datetime import datetime, timezone

import swarm_dungeon as sd
from server import db, ws_manager, logger, send_telegram_message
from services.auto_exec import (
    auto_execute_prediction,
    get_auto_exec_config,
    _apply_signal_intelligence,
)
from services.signal_tracker import record_prediction_with_price


DIRECTION_EMOJI = {"long_bias": "\U0001F7E2", "short_bias": "\U0001F534", "wait": "\U0001F7E1"}
DIRECTION_TEXT = {"long_bias": "LONG", "short_bias": "SHORT", "wait": "WAIT"}


def _format_prediction_telegram(sym: str, result: dict) -> str:
    emoji = DIRECTION_EMOJI.get(result["direction"], "\U0001F4CA")
    direction_text = DIRECTION_TEXT.get(result["direction"], "?")

    # Add intelligence info if available
    intel_line = ""
    if result.get("intelligence_applied"):
        adj = result.get("confidence_adjustment", 0)
        hwr = result.get("historical_win_rate", 0)
        adj_emoji = "\u2B06\uFE0F" if adj > 0 else "\u2B07\uFE0F" if adj < 0 else "\u27A1\uFE0F"
        intel_line = f"\n{adj_emoji} Intel: WR {hwr*100:.0f}% | Adj {adj*100:+.1f}%"

    return (
        f"{emoji} <b>Swarm Prediction: {sym}</b>\n"
        f"Direction: <b>{direction_text}</b>\n"
        f"Confidence: <b>{result['confidence']*100:.1f}%</b>\n"
        f"Votes: \U0001F7E2{result['votes']['bullish_count']}B "
        f"\U0001F534{result['votes']['bearish_count']}S "
        f"\U0001F7E1{result['votes']['neutral_count']}N"
        f"{intel_line}"
    )


async def _get_telegram_users():
    return await db.users.find(
        {"telegram_chat_id": {"$ne": None}, "telegram_notifications": True}
    ).to_list(50)


async def _broadcast_to_telegram(users: list, message: str):
    for u in users:
        await send_telegram_message(u["telegram_chat_id"], message)


async def _process_scheduled_symbol(sym: str, config: dict):
    """Process one symbol in the scheduler — predict, apply intelligence, log, alert, auto-exec."""
    result = sd.aggregate_prediction(sym)
    result = await _apply_signal_intelligence(result)

    logger.info(f"[SCHEDULER] {sym}: {result['direction']} conf={result['confidence']:.3f}" +
                (f" (intel: WR={result.get('historical_win_rate',0):.1%} adj={result.get('confidence_adjustment',0):+.3f})"
                 if result.get('intelligence_applied') else ""))

    await ws_manager.broadcast({"type": "scheduler_prediction", "data": {
        "symbol": sym, "direction": result["direction"],
        "confidence": result["confidence"],
        "votes": result["votes"], "timestamp": result["timestamp"]
    }})

    await db.scheduler_runs.insert_one({
        "symbol": sym, "direction": result["direction"],
        "confidence": result["confidence"], "votes": result["votes"],
        "timestamp": result["timestamp"], "created_at": datetime.now(timezone.utc)
    })

    # Record prediction with entry price for accuracy tracking
    await record_prediction_with_price(result)

    users_tg = await _get_telegram_users()
    await _broadcast_to_telegram(users_tg, _format_prediction_telegram(sym, result))

    if not config.get("enabled"):
        return

    exec_result = await auto_execute_prediction(result)
    if exec_result.get("executed"):
        trade_msg = (
            f"\U0001F4B0 <b>Auto-Trade Executed!</b>\n"
            f"Symbol: {exec_result['order'].get('symbol', '?')}\n"
            f"Side: {exec_result['order'].get('side', '?').upper()}\n"
            f"Status: {exec_result['order'].get('status', '?')}"
        )
        await _broadcast_to_telegram(users_tg, trade_msg)
    logger.info(f"[SCHEDULER] Auto-exec: {exec_result.get('executed')} - {exec_result.get('reason', 'ok')}")


async def scheduler_loop():
    """Background task that runs swarm predictions on a schedule."""
    logger.info("Scheduler loop started")
    while True:
        try:
            config = await get_auto_exec_config()
            if not config.get("scheduler_enabled"):
                await asyncio.sleep(10)
                continue

            interval = max(config.get("scheduler_interval_minutes", 15), 1) * 60
            symbols = config.get("scheduler_symbols", ["BTCUSDT"])

            for sym in symbols:
                try:
                    await _process_scheduled_symbol(sym, config)
                except Exception as e:
                    logger.error(f"[SCHEDULER] Error for {sym}: {e}")

            await asyncio.sleep(interval)

        except asyncio.CancelledError:
            logger.info("Scheduler loop cancelled")
            break
        except Exception as e:
            logger.error(f"[SCHEDULER] Loop error: {e}")
            await asyncio.sleep(30)
