from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from app.db import init_db
from app.rollout_engine import initialize_capital
from app.swarm_engine import seed_agents
from app.api.health import router as health_router
from app.api.rollout import router as rollout_router
from app.api.swarm import router as swarm_router

app = FastAPI(title="MiroFish v13.0 Space Dungeon Swarm Dashboard", version="13.0.0")

@app.on_event("startup")
def startup():
    init_db()
    initialize_capital()
    seed_agents()

app.include_router(health_router)
app.include_router(rollout_router, prefix="/api/rollout")
app.include_router(swarm_router, prefix="/api/swarm")

@app.get("/", response_class=HTMLResponse)
def home():
    return open("app/static/index.html", "r", encoding="utf-8").read()
