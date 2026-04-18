"""
Bitget Exchange HTTP routes: status, tickers, OHLCV, orderbook, balance,
positions, create/cancel orders, open orders, order history.
"""
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import bitget_exchange as bgx
from server import db, get_current_user, notify_user, ws_manager

router = APIRouter()


class OrderRequest(BaseModel):
    symbol: str
    side: str  # buy/sell
    order_type: str = "market"  # market/limit
    amount: float
    price: float | None = None
    market_type: str = "spot"  # spot/futures


class CancelOrderRequest(BaseModel):
    order_id: str
    symbol: str
    market_type: str = "spot"


@router.get("/exchange/status")
async def exchange_status():
    return {"configured": bgx.is_configured(), "exchange": "bitget"}


@router.get("/exchange/ticker/{symbol:path}")
async def exchange_ticker(symbol: str, market_type: str = "spot"):
    try:
        return await bgx.fetch_ticker(symbol, market_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/exchange/tickers")
async def exchange_tickers(symbols: str = "BTC/USDT,ETH/USDT,SOL/USDT,XRP/USDT", market_type: str = "spot"):
    sym_list = [s.strip() for s in symbols.split(",") if s.strip()]
    return {"tickers": await bgx.fetch_tickers(sym_list, market_type)}


@router.get("/exchange/ohlcv/{symbol:path}")
async def exchange_ohlcv(symbol: str, timeframe: str = "1h", limit: int = 100, market_type: str = "spot"):
    try:
        return {"candles": await bgx.fetch_ohlcv(symbol, timeframe, limit, market_type)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/exchange/orderbook/{symbol:path}")
async def exchange_orderbook(symbol: str, limit: int = 20, market_type: str = "spot"):
    try:
        return await bgx.fetch_orderbook(symbol, limit, market_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/exchange/balance")
async def exchange_balance(market_type: str = "spot", request: Request = None):
    if request:
        await get_current_user(request)
    return await bgx.fetch_balance(market_type)


@router.get("/exchange/positions")
async def exchange_positions(request: Request):
    await get_current_user(request)
    return {"positions": await bgx.fetch_positions()}


@router.post("/exchange/order")
async def exchange_create_order(data: OrderRequest, request: Request):
    user = await get_current_user(request)
    result = await bgx.create_order(
        data.symbol, data.side, data.order_type, data.amount,
        data.price, data.market_type
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    # Log trade + notify
    await db.trade_history.insert_one({
        "user_id": user["_id"],
        "order": result,
        "market_type": data.market_type,
        "created_at": datetime.now(UTC)
    })
    await ws_manager.send_to_user(user["_id"], {"type": "order_filled", "data": result})
    await notify_user(user["_id"], "Order Placed",
        f"{data.side.upper()} {data.amount} {data.symbol} @ {data.order_type}",
        "success" if result.get("status") != "rejected" else "error")
    return result


@router.post("/exchange/cancel")
async def exchange_cancel_order(data: CancelOrderRequest, request: Request):
    await get_current_user(request)
    result = await bgx.cancel_order(data.order_id, data.symbol, data.market_type)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/exchange/open-orders")
async def exchange_open_orders(symbol: str = None, market_type: str = "spot", request: Request = None):
    if request:
        await get_current_user(request)
    return {"orders": await bgx.fetch_open_orders(symbol, market_type)}


@router.get("/exchange/order-history")
async def exchange_order_history(symbol: str = None, limit: int = 50, market_type: str = "spot", request: Request = None):
    if request:
        await get_current_user(request)
    return {"orders": await bgx.fetch_order_history(symbol, limit, market_type)}
