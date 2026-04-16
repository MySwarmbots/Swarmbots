from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from app.api.health import router as health_router
from app.api.core import router as core_router
from app.api.webhook import router as webhook_router
from app.api.swarm import router as swarm_router
from app.api.live import router as live_router
from app.api.backtest import router as backtest_router

app = FastAPI(title="MiroFish Profit-Optimized Engine", version="11.8.0")
app.include_router(health_router)
app.include_router(core_router, prefix="/api/core")
app.include_router(webhook_router, prefix="/api/webhook")
app.include_router(swarm_router, prefix="/api/swarm")
app.include_router(live_router, prefix="/api/live")
app.include_router(backtest_router, prefix="/api/backtest")

@app.get("/", response_class=HTMLResponse)
def home():
    return open("app/static/index.html", "r", encoding="utf-8").read()
