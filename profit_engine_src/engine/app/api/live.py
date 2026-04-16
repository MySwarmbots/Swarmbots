from fastapi import APIRouter
from app.state import positions, realized_pnl_usd, order_log, trade_log
router = APIRouter()
@router.get("/positions")
def positions_view():
    return {"positions": list(positions.values())}
@router.get("/pnl")
def pnl():
    return {"realized_pnl_usd": realized_pnl_usd}
@router.get("/orders")
def orders():
    return {"orders": list(order_log)}
@router.get("/trades")
def trades():
    return {"trades": list(trade_log)}
