"""
Bitget Exchange Integration via CCXT
Supports: Spot + Futures (USDT-perpetual), balance, tickers, orders, positions, OHLCV
"""
import asyncio
import logging
import os

import ccxt

logger = logging.getLogger(__name__)

_exchange_spot: ccxt.bitget | None = None
_exchange_futures: ccxt.bitget | None = None


def _get_credentials():
    key = os.environ.get("BITGET_API_KEY", "")
    secret = os.environ.get("BITGET_API_SECRET", "")
    passphrase = os.environ.get("BITGET_PASSPHRASE", "")
    return key, secret, passphrase


def is_configured() -> bool:
    key, secret, passphrase = _get_credentials()
    return bool(key and secret and passphrase)


def get_spot_exchange() -> ccxt.bitget:
    global _exchange_spot
    if _exchange_spot is None:
        key, secret, passphrase = _get_credentials()
        _exchange_spot = ccxt.bitget({
            "apiKey": key,
            "secret": secret,
            "password": passphrase,
            "enableRateLimit": True,
            "options": {"defaultType": "spot"},
        })
    return _exchange_spot


def get_futures_exchange() -> ccxt.bitget:
    global _exchange_futures
    if _exchange_futures is None:
        key, secret, passphrase = _get_credentials()
        _exchange_futures = ccxt.bitget({
            "apiKey": key,
            "secret": secret,
            "password": passphrase,
            "enableRateLimit": True,
            "options": {"defaultType": "swap"},
        })
    return _exchange_futures


# ──────────────────── Market Data (no auth needed) ────────────────────

async def fetch_ticker(symbol: str, market_type: str = "spot") -> dict:
    ex = get_spot_exchange() if market_type == "spot" else get_futures_exchange()
    ticker = await asyncio.to_thread(ex.fetch_ticker, symbol)
    return {
        "symbol": ticker["symbol"],
        "last": ticker.get("last"),
        "bid": ticker.get("bid"),
        "ask": ticker.get("ask"),
        "high": ticker.get("high"),
        "low": ticker.get("low"),
        "volume": ticker.get("baseVolume"),
        "change_pct": ticker.get("percentage"),
        "timestamp": ticker.get("datetime"),
    }


async def fetch_tickers(symbols: list[str], market_type: str = "spot") -> list[dict]:
    results = []
    for s in symbols:
        try:
            t = await fetch_ticker(s, market_type)
            results.append(t)
        except Exception as e:
            logger.warning(f"Ticker fetch failed for {s}: {e}")
            results.append({"symbol": s, "error": str(e)})
    return results


async def fetch_ohlcv(symbol: str, timeframe: str = "1h", limit: int = 100, market_type: str = "spot") -> list[dict]:
    ex = get_spot_exchange() if market_type == "spot" else get_futures_exchange()
    candles = await asyncio.to_thread(ex.fetch_ohlcv, symbol, timeframe, limit=limit)
    return [
        {"ts": c[0], "open": c[1], "high": c[2], "low": c[3], "close": c[4], "volume": c[5]}
        for c in candles
    ]


async def fetch_orderbook(symbol: str, limit: int = 20, market_type: str = "spot") -> dict:
    ex = get_spot_exchange() if market_type == "spot" else get_futures_exchange()
    ob = await asyncio.to_thread(ex.fetch_order_book, symbol, limit)
    return {
        "symbol": symbol,
        "bids": ob["bids"][:limit],
        "asks": ob["asks"][:limit],
        "timestamp": ob.get("datetime"),
    }


# ──────────────────── Account (auth required) ────────────────────

async def fetch_balance(market_type: str = "spot") -> dict:
    if not is_configured():
        return {"error": "Bitget API keys not configured", "total": {}, "free": {}, "used": {}}
    ex = get_spot_exchange() if market_type == "spot" else get_futures_exchange()
    bal = await asyncio.to_thread(ex.fetch_balance)
    # Filter out zero balances
    total = {k: v for k, v in bal.get("total", {}).items() if v and float(v) > 0}
    free = {k: v for k, v in bal.get("free", {}).items() if v and float(v) > 0}
    used = {k: v for k, v in bal.get("used", {}).items() if v and float(v) > 0}
    return {"total": total, "free": free, "used": used}


async def fetch_positions() -> list[dict]:
    if not is_configured():
        return []
    ex = get_futures_exchange()
    try:
        positions = await asyncio.to_thread(ex.fetch_positions)
        return [
            {
                "symbol": p["symbol"],
                "side": p.get("side"),
                "contracts": p.get("contracts"),
                "notional": p.get("notional"),
                "unrealized_pnl": p.get("unrealizedPnl"),
                "leverage": p.get("leverage"),
                "entry_price": p.get("entryPrice"),
                "mark_price": p.get("markPrice"),
                "liquidation_price": p.get("liquidationPrice"),
                "margin_mode": p.get("marginMode"),
            }
            for p in positions
            if p.get("contracts") and float(p["contracts"]) > 0
        ]
    except Exception as e:
        logger.error(f"Fetch positions error: {e}")
        return []


# ──────────────────── Trading (auth required) ────────────────────

async def create_order(symbol: str, side: str, order_type: str, amount: float,
                       price: float = None, market_type: str = "spot", params: dict = None) -> dict:
    if not is_configured():
        return {"error": "Bitget API keys not configured"}
    ex = get_spot_exchange() if market_type == "spot" else get_futures_exchange()
    try:
        extra = params or {}
        # Bitget spot market orders: use createMarketBuyOrderWithCost for buy
        if order_type == "market" and market_type == "spot":
            if side == "buy":
                # For market buy on Bitget spot, pass cost in USDT
                ticker = await asyncio.to_thread(ex.fetch_ticker, symbol)
                cost = round(amount * (ticker.get("last", 0) or 1), 4)
                extra["cost"] = cost
                order = await asyncio.to_thread(
                    ex.create_order, symbol, "market", "buy", cost, None, extra
                )
            else:
                order = await asyncio.to_thread(
                    ex.create_order, symbol, "market", "sell", amount, None, extra
                )
        else:
            order = await asyncio.to_thread(
                ex.create_order, symbol, order_type, side, amount, price, extra
            )
        return {
            "id": order["id"],
            "symbol": order["symbol"],
            "type": order["type"],
            "side": order["side"],
            "amount": order.get("amount"),
            "price": order.get("price") or order.get("average"),
            "cost": order.get("cost"),
            "status": order["status"],
            "timestamp": order.get("datetime"),
        }
    except Exception as e:
        logger.error(f"Create order error: {e}")
        return {"error": str(e)}


async def cancel_order(order_id: str, symbol: str, market_type: str = "spot") -> dict:
    if not is_configured():
        return {"error": "Bitget API keys not configured"}
    ex = get_spot_exchange() if market_type == "spot" else get_futures_exchange()
    try:
        result = await asyncio.to_thread(ex.cancel_order, order_id, symbol)
        return {"id": order_id, "status": "cancelled", "result": str(result)}
    except Exception as e:
        logger.error(f"Cancel order error: {e}")
        return {"error": str(e)}


async def fetch_open_orders(symbol: str = None, market_type: str = "spot") -> list[dict]:
    if not is_configured():
        return []
    ex = get_spot_exchange() if market_type == "spot" else get_futures_exchange()
    try:
        orders = await asyncio.to_thread(ex.fetch_open_orders, symbol)
        return [
            {
                "id": o["id"],
                "symbol": o["symbol"],
                "type": o["type"],
                "side": o["side"],
                "amount": o["amount"],
                "price": o.get("price"),
                "filled": o.get("filled"),
                "status": o["status"],
                "timestamp": o.get("datetime"),
            }
            for o in orders
        ]
    except Exception as e:
        logger.error(f"Fetch open orders error: {e}")
        return []


async def fetch_order_history(symbol: str = None, limit: int = 50, market_type: str = "spot") -> list[dict]:
    if not is_configured():
        return []
    ex = get_spot_exchange() if market_type == "spot" else get_futures_exchange()
    try:
        orders = await asyncio.to_thread(ex.fetch_closed_orders, symbol, limit=limit)
        return [
            {
                "id": o["id"],
                "symbol": o["symbol"],
                "type": o["type"],
                "side": o["side"],
                "amount": o["amount"],
                "price": o.get("price") or o.get("average"),
                "filled": o.get("filled"),
                "cost": o.get("cost"),
                "status": o["status"],
                "timestamp": o.get("datetime"),
            }
            for o in orders
        ]
    except Exception as e:
        logger.error(f"Fetch order history error: {e}")
        return []
