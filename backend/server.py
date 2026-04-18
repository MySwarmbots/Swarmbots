from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt as pyjwt
import secrets
import json
import asyncio
import httpx
import resend
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta

# LLM integration
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

# Password hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def ensure_utc(dt):
    """Make any datetime timezone-aware (UTC). Handles naive datetimes from MongoDB Atlas."""
    if dt is None:
        return None
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

# JWT Token management
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"
    }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"
    }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Auth helper
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Create apps
app = FastAPI(title="MiroFish Mobile API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== WEBSOCKET MANAGER ==============

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket connected: {user_id}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id] = [c for c in self.active_connections[user_id] if c != websocket]
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket disconnected: {user_id}")

    async def send_to_user(self, user_id: str, data: dict):
        if user_id in self.active_connections:
            dead = []
            for conn in self.active_connections[user_id]:
                try:
                    await conn.send_json(data)
                except Exception:
                    dead.append(conn)
            for d in dead:
                self.active_connections[user_id].remove(d)

    async def broadcast(self, data: dict):
        dead_users = []
        for uid, conns in self.active_connections.items():
            dead = []
            for conn in conns:
                try:
                    await conn.send_json(data)
                except Exception:
                    dead.append(conn)
            for d in dead:
                conns.remove(d)
            if not conns:
                dead_users.append(uid)
        for uid in dead_users:
            del self.active_connections[uid]

ws_manager = ConnectionManager()

# ============== TELEGRAM BOT ==============

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

async def send_telegram_message(chat_id: str, text: str):
    if not TELEGRAM_TOKEN:
        logger.warning("Telegram bot token not configured")
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient() as client_http:
            resp = await client_http.post(url, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML"
            }, timeout=10)
            result = resp.json()
            if result.get("ok"):
                logger.info(f"Telegram message sent to {chat_id}")
                return True
            else:
                logger.error(f"Telegram API error: {result}")
                return False
    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return False

async def send_email(to_email: str, subject: str, html_content: str):
    """Send email via Resend, falls back to logging if not configured."""
    if not RESEND_API_KEY:
        logger.info(f"[EMAIL FALLBACK] To: {to_email} | Subject: {subject} | (Set RESEND_API_KEY to send real emails)")
        return False
    try:
        params = {
            "from": f"MiroFish <{SENDER_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}, id: {result.get('id', 'unknown')}")
        return True
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False

def build_email_html(title: str, body: str, notif_type: str = "info"):
    """Build a simple, styled HTML email."""
    color_map = {"success": "#00FF66", "error": "#FF3B30", "warning": "#FFCC00", "info": "#002FA7"}
    accent = color_map.get(notif_type, "#FFFFFF")
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;">
<tr><td style="padding:24px 24px 16px;border-bottom:2px solid {accent};">
<h1 style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;letter-spacing:2px;">MIROFISH</h1>
</td></tr>
<tr><td style="padding:24px;">
<h2 style="margin:0 0 12px;font-size:16px;color:#FFFFFF;">{title}</h2>
<p style="margin:0;font-size:14px;color:#8A8A8A;line-height:1.6;">{body}</p>
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #222222;">
<p style="margin:0;font-size:11px;color:#555555;">MiroFish Swarm Trading System</p>
</td></tr>
</table>
</td></tr></table>
</body></html>"""

async def notify_user(user_id: str, title: str, message: str, notif_type: str = "info"):
    """Create in-app notification + send Telegram + Email + WebSocket push"""
    notif_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif_doc)

    # WebSocket push
    await ws_manager.send_to_user(user_id, {
        "type": "notification",
        "data": {k: v for k, v in notif_doc.items() if k != "_id" and k != "user_id"}
    })

    user = await db.users.find_one({"_id": ObjectId(user_id)})

    # Telegram push if linked and enabled
    if user and user.get("telegram_chat_id") and user.get("telegram_notifications", True):
        emoji = {"success": "\u2705", "error": "\U0001F6A8", "warning": "\u26A0\uFE0F", "info": "\u2139\uFE0F"}.get(notif_type, "\U0001F4E2")
        await send_telegram_message(user["telegram_chat_id"], f"{emoji} <b>{title}</b>\n{message}")

    # Email if enabled
    if user and user.get("email") and user.get("email_notifications", True):
        html = build_email_html(title, message, notif_type)
        await send_email(user["email"], f"[MiroFish] {title}", html)

# ============== MODELS ==============

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ValidationRunInput(BaseModel):
    symbol: str
    exchange: str
    expected_price: float
    actual_price: float
    expected_fee_bps: float = 6.0
    actual_fee_bps: float = 6.0

class GateUpdateInput(BaseModel):
    mode: str
    blocked: bool = False
    reason: str = ""

class AgentCreate(BaseModel):
    name: str
    strategy: str
    exchange: str
    trading_pairs: List[str]
    risk_level: str = "medium"

class AIInsightRequest(BaseModel):
    prompt: str
    context: Optional[str] = None

class CreateCheckoutRequest(BaseModel):
    plan: str
    origin_url: str

class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "info"

class TelegramLinkRequest(BaseModel):
    chat_id: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    email_notifications: Optional[bool] = None
    telegram_notifications: Optional[bool] = None

# ============== VALIDATION ENGINE ==============

MAX_ALLOWED_SLIPPAGE_BPS = 15.0
MAX_ALLOWED_FEE_BPS = 12.0
MAX_RECON_DRIFT_PCT = 1.0

async def get_gate_state():
    gate = await db.rollout_gates.find_one({"_id": "main_gate"})
    if not gate:
        await db.rollout_gates.insert_one({"_id": "main_gate", "mode": "shadow", "blocked": False, "reason": ""})
        return {"mode": "shadow", "blocked": False, "reason": ""}
    return {"mode": gate["mode"], "blocked": gate["blocked"], "reason": gate.get("reason", "")}

async def set_gate_state(mode: str, blocked: bool, reason: str = ""):
    await db.rollout_gates.update_one(
        {"_id": "main_gate"},
        {"$set": {"mode": mode, "blocked": blocked, "reason": reason}},
        upsert=True
    )
    return await get_gate_state()

async def validate_fill(symbol, exchange, expected_price, actual_price, expected_fee_bps, actual_fee_bps):
    drift_pct = abs(actual_price - expected_price) / max(expected_price, 1e-9) * 100.0
    slippage_bps = abs(actual_price - expected_price) / max(expected_price, 1e-9) * 10000.0
    reasons = []
    passed = True
    if slippage_bps > MAX_ALLOWED_SLIPPAGE_BPS:
        passed = False
        reasons.append("slippage_exceeded")
    if actual_fee_bps > MAX_ALLOWED_FEE_BPS:
        passed = False
        reasons.append("fee_exceeded")
    if drift_pct > MAX_RECON_DRIFT_PCT:
        passed = False
        reasons.append("recon_drift_exceeded")

    gate = await get_gate_state()
    run_doc = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "symbol": symbol, "exchange": exchange, "mode": gate["mode"],
        "expected_price": expected_price, "actual_price": actual_price,
        "expected_fee_bps": expected_fee_bps, "actual_fee_bps": actual_fee_bps,
        "drift_pct": round(drift_pct, 4), "slippage_bps": round(slippage_bps, 4),
        "passed": passed, "reasons": reasons
    }
    await db.validation_runs.insert_one(run_doc)
    if not passed:
        await set_gate_state(gate["mode"], True, ",".join(reasons))

    # Broadcast validation result via WebSocket
    await ws_manager.broadcast({"type": "validation_run", "data": {k: v for k, v in run_doc.items() if k != "_id"}})

    return {
        "symbol": symbol, "exchange": exchange,
        "drift_pct": round(drift_pct, 4), "slippage_bps": round(slippage_bps, 4),
        "passed": passed, "reasons": reasons, "gate": await get_gate_state(),
    }

async def get_validation_summary():
    runs = await db.validation_runs.find({}, {"_id": 0}).sort("ts", -1).limit(200).to_list(200)
    total = len(runs)
    passed = sum(1 for r in runs if r.get("passed"))
    return {"total_runs": total, "passed": passed, "failed": total - passed, "gate": await get_gate_state()}


# ============== VALIDATION ROUTES ==============

@api_router.get("/validation/gate")
async def get_gate():
    return await get_gate_state()

@api_router.post("/validation/gate")
async def update_gate(data: GateUpdateInput, request: Request):
    await get_current_user(request)
    result = await set_gate_state(data.mode, data.blocked, data.reason)
    await ws_manager.broadcast({"type": "gate_update", "data": result})
    return result

@api_router.post("/validation/run")
async def create_validation_run(data: ValidationRunInput):
    return await validate_fill(data.symbol, data.exchange, data.expected_price, data.actual_price, data.expected_fee_bps, data.actual_fee_bps)

@api_router.get("/validation/runs")
async def get_validation_runs(limit: int = 100):
    runs = await db.validation_runs.find({}, {"_id": 0}).sort("ts", -1).limit(limit).to_list(limit)
    return {"runs": runs}

@api_router.get("/validation/summary")
async def get_summary():
    return await get_validation_summary()

# ============== AGENTS ROUTES ==============

def generate_performance_history(days=30):
    """Generate simulated daily performance data for charts"""
    history = []
    cumulative_pnl = 0
    for i in range(days):
        day = (datetime.now(timezone.utc) - timedelta(days=days - i)).strftime("%Y-%m-%d")
        daily_pnl = round(secrets.randbelow(4501) / 10 - 150, 2)
        cumulative_pnl += daily_pnl
        trades = secrets.randbelow(36) + 5
        wins = secrets.randbelow(max(1, int(trades * 0.5))) + int(trades * 0.3)
        wins = min(wins, trades)
        history.append({
            "date": day,
            "daily_pnl": round(daily_pnl, 2),
            "cumulative_pnl": round(cumulative_pnl, 2),
            "trades": trades,
            "wins": wins,
            "win_rate": round(wins / max(trades, 1) * 100, 1),
            "volume": round(secrets.randbelow(45001) + 5000 + secrets.randbelow(100) / 100, 2)
        })
    return history

@api_router.get("/agents")
async def get_agents(request: Request):
    user = await get_current_user(request)
    agents = await db.agents.find({"user_id": user["_id"]}, {"_id": 0, "user_id": 0}).to_list(100)
    return {"agents": agents}

@api_router.get("/agents/{agent_id}/performance")
async def get_agent_performance(agent_id: str, request: Request):
    user = await get_current_user(request)
    agent = await db.agents.find_one({"id": agent_id, "user_id": user["_id"]})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Check if performance data already exists
    perf = await db.agent_performance.find_one({"agent_id": agent_id}, {"_id": 0})
    if not perf:
        history = generate_performance_history()
        perf = {"agent_id": agent_id, "history": history, "generated_at": datetime.now(timezone.utc).isoformat()}
        await db.agent_performance.insert_one(perf)
        perf.pop("_id", None)

    return perf

@api_router.get("/agents/portfolio/summary")
async def get_portfolio_summary(request: Request):
    user = await get_current_user(request)
    agents = await db.agents.find({"user_id": user["_id"]}, {"_id": 0, "user_id": 0}).to_list(100)

    # Aggregate performance data for portfolio overview
    strategies = {}
    exchanges = {}
    for a in agents:
        s = a.get("strategy", "unknown")
        e = a.get("exchange", "unknown")
        strategies[s] = strategies.get(s, 0) + a.get("pnl", 0)
        exchanges[e] = exchanges.get(e, 0) + a.get("pnl", 0)

    strategy_data = [{"name": k, "pnl": round(v, 2)} for k, v in strategies.items()]
    exchange_data = [{"name": k, "pnl": round(v, 2)} for k, v in exchanges.items()]

    # Generate portfolio-wide daily history
    portfolio_history = generate_performance_history(30)

    return {
        "by_strategy": strategy_data,
        "by_exchange": exchange_data,
        "portfolio_history": portfolio_history,
        "total_agents": len(agents),
        "total_pnl": round(sum(ag.get("pnl", 0) for ag in agents), 2)
    }

@api_router.post("/agents")
async def create_agent(data: AgentCreate, request: Request):
    user = await get_current_user(request)
    agent_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "name": data.name, "strategy": data.strategy,
        "exchange": data.exchange, "trading_pairs": data.trading_pairs,
        "risk_level": data.risk_level, "status": "active",
        "pnl": round(secrets.randbelow(2501) - 500 + secrets.randbelow(100) / 100, 2),
        "win_rate": round(0.45 + (secrets.randbelow(31) / 100), 2),
        "total_trades": secrets.randbelow(491) + 10,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.agents.insert_one(agent_doc)
    agent_resp = {k: v for k, v in agent_doc.items() if k != "_id" and k != "user_id"}

    # Broadcast
    await ws_manager.send_to_user(user["_id"], {"type": "agent_created", "data": agent_resp})
    # Notify
    await notify_user(user["_id"], "Agent Deployed", f"Agent '{data.name}' is now active on {data.exchange}", "success")

    return agent_resp

@api_router.patch("/agents/{agent_id}/toggle")
async def toggle_agent(agent_id: str, request: Request):
    user = await get_current_user(request)
    agent = await db.agents.find_one({"id": agent_id, "user_id": user["_id"]})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    new_status = "paused" if agent["status"] == "active" else "active"
    await db.agents.update_one({"id": agent_id}, {"$set": {"status": new_status}})

    # Broadcast + notify
    await ws_manager.send_to_user(user["_id"], {"type": "agent_status", "data": {"id": agent_id, "status": new_status}})
    status_text = "activated" if new_status == "active" else "paused"
    await notify_user(user["_id"], f"Agent {status_text.title()}", f"Agent '{agent['name']}' has been {status_text}", "info")

    return {"status": new_status}

@api_router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, request: Request):
    user = await get_current_user(request)
    agent = await db.agents.find_one({"id": agent_id, "user_id": user["_id"]})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.agents.delete_one({"id": agent_id, "user_id": user["_id"]})
    await db.agent_performance.delete_one({"agent_id": agent_id})
    await ws_manager.send_to_user(user["_id"], {"type": "agent_deleted", "data": {"id": agent_id}})
    return {"message": "Agent deleted"}

# ============== AI INSIGHTS ROUTES ==============

@api_router.post("/ai/insights")
async def get_ai_insights(data: AIInsightRequest, request: Request):
    await get_current_user(request)
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    system_message = """You are MiroFish AI, an expert crypto trading analyst. 
    Provide concise, actionable trading insights and analysis.
    Format responses in a terminal-style output with clear sections.
    Focus on: market trends, risk assessment, and strategic recommendations.
    Keep responses under 500 words."""
    chat = LlmChat(
        api_key=api_key, session_id=f"insight-{uuid.uuid4()}", system_message=system_message
    ).with_model("openai", "gpt-4o")
    prompt = data.prompt
    if data.context:
        prompt = f"Context: {data.context}\n\nQuestion: {data.prompt}"
    user_message = UserMessage(text=prompt)
    response = await chat.send_message(user_message)
    return {"insight": response, "timestamp": datetime.now(timezone.utc).isoformat()}

# ============== DASHBOARD STATS ==============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    user = await get_current_user(request)
    agents = await db.agents.find({"user_id": user["_id"]}).to_list(100)
    active_agents = sum(1 for a in agents if a.get("status") == "active")
    total_pnl = sum(a.get("pnl", 0) for a in agents)
    avg_win_rate = sum(a.get("win_rate", 0) for a in agents) / len(agents) if agents else 0
    total_trades = sum(a.get("total_trades", 0) for a in agents)
    validation = await get_validation_summary()
    unread = await db.notifications.count_documents({"user_id": user["_id"], "read": False})
    return {
        "total_agents": len(agents), "active_agents": active_agents,
        "total_pnl": round(total_pnl, 2), "avg_win_rate": round(avg_win_rate * 100, 1),
        "total_trades": total_trades, "validation_summary": validation,
        "unread_notifications": unread
    }

@api_router.get("/dashboard/dungeon-overview")
async def dashboard_dungeon_overview():
    """Returns live dungeon agent avatars + latest prediction + scheduler status for the dashboard."""
    dungeon_agents = sd.generate_agents()
    latest_preds = list(sd.prediction_log)[:3]
    config = await get_auto_exec_config()
    latest_scheduler = await db.scheduler_runs.find({}, {"_id": 0}).sort("created_at", -1).limit(3).to_list(3)
    return {
        "agents": dungeon_agents,
        "latest_predictions": latest_preds,
        "scheduler": {
            "enabled": config.get("scheduler_enabled", False),
            "auto_exec_enabled": config.get("enabled", False),
            "interval_minutes": config.get("scheduler_interval_minutes", 15),
            "total_auto_trades": config.get("total_trades", 0),
        },
        "recent_scheduler_runs": latest_scheduler,
    }

# ============== SIGNAL ACCURACY TRACKER ==============

async def _snapshot_price(symbol: str) -> float:
    """Fetch current price for a symbol via Bitget or return 0."""
    ccxt_sym = _normalize_symbol(symbol)
    try:
        ticker = await bgx.fetch_ticker(ccxt_sym, "spot")
        return ticker.get("last", 0) or 0
    except Exception:
        return 0


async def record_prediction_with_price(run: dict):
    """Attach entry price to a scheduler run for later accuracy check."""
    price = await _snapshot_price(run["symbol"])
    if price <= 0:
        return
    await db.signal_accuracy.insert_one({
        "symbol": run["symbol"],
        "direction": run["direction"],
        "confidence": run["confidence"],
        "entry_price": price,
        "exit_price": None,
        "pnl_pct": None,
        "correct": None,
        "checked": False,
        "created_at": datetime.now(timezone.utc),
    })


async def check_pending_signals():
    """Check signals older than 15 min and record exit price + accuracy. Batched by symbol."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    pending = await db.signal_accuracy.find(
        {"checked": False, "created_at": {"$lt": cutoff}}
    ).limit(50).to_list(50)

    if not pending:
        return

    # Batch: fetch price once per unique symbol
    unique_symbols = list(set(s["symbol"] for s in pending))
    price_cache = {}
    for sym in unique_symbols:
        price_cache[sym] = await _snapshot_price(sym)

    # Update all pending signals using cached prices
    for sig in pending:
        exit_price = price_cache.get(sig["symbol"], 0)
        if exit_price <= 0:
            continue
        entry = sig["entry_price"]
        direction = sig["direction"]

        if direction == "long_bias":
            pnl_pct = round((exit_price - entry) / entry * 100, 4)
            correct = exit_price > entry
        elif direction == "short_bias":
            pnl_pct = round((entry - exit_price) / entry * 100, 4)
            correct = exit_price < entry
        else:
            pnl_pct = 0.0
            correct = None

        await db.signal_accuracy.update_one(
            {"_id": sig["_id"]},
            {"$set": {"exit_price": exit_price, "pnl_pct": pnl_pct, "correct": correct, "checked": True}}
        )



# ============== HEALTH ==============

@api_router.get("/")
async def root():
    return {"message": "MiroFish API v2.0.0", "status": "operational"}

@api_router.get("/health")
async def health():
    return {"status": "ok", "validation": await get_validation_summary()}


# ============== PROFIT ENGINE ROUTES ==============
# HTTP routes extracted to routes/engine.py. Library imports kept here
# because the scheduler/auto-exec helpers also use them.
import profit_engine as pe
import bitget_exchange as bgx

# ============== SPACE DUNGEON SWARM ROUTES ==============

import swarm_dungeon as sd

# Auto-execution state (in-memory, persisted to MongoDB)
auto_exec_defaults = {
    "enabled": False,
    "max_trade_usd": 0.50,
    "min_confidence": 0.60,
    "allowed_symbols": ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
    "allowed_directions": ["long_bias", "short_bias"],
    "market_type": "spot",
    "cooldown_seconds": 300,
    "last_trade_ts": None,
    "total_trades": 0,
    "total_pnl_estimate": 0.0,
    "scheduler_enabled": False,
    "scheduler_interval_minutes": 15,
    "scheduler_symbols": ["BTCUSDT", "ETHUSDT"],
    "symbol_multipliers": {
        "BTC/USDT": 1.5, "ETH/USDT": 1.5, "XRP/USDT": 1.3, "ADA/USDT": 1.2,
        "DOGE/USDT": 1.0, "SOL/USDT": 1.0
    },
    "quiet_hours_utc": [9],
}

# Scheduler background task ref
_scheduler_task = None

async def get_auto_exec_config():
    doc = await db.auto_exec_config.find_one({"_id": "main"})
    if not doc:
        await db.auto_exec_config.insert_one({"_id": "main", **auto_exec_defaults})
        return auto_exec_defaults.copy()
    doc.pop("_id", None)
    return doc

async def update_auto_exec_config(updates: dict):
    await db.auto_exec_config.update_one({"_id": "main"}, {"$set": updates}, upsert=True)
    return await get_auto_exec_config()

class AutoExecConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    max_trade_usd: Optional[float] = None
    min_confidence: Optional[float] = None
    allowed_symbols: Optional[List[str]] = None
    allowed_directions: Optional[List[str]] = None
    market_type: Optional[str] = None
    cooldown_seconds: Optional[int] = None
    scheduler_enabled: Optional[bool] = None
    scheduler_interval_minutes: Optional[int] = None
    scheduler_symbols: Optional[List[str]] = None
    symbol_multipliers: Optional[Dict[str, float]] = None
    quiet_hours_utc: Optional[List[int]] = None

async def auto_execute_prediction(prediction: dict):
    """Core auto-execution: takes a swarm prediction and places a real Bitget order if conditions are met."""
    config = await get_auto_exec_config()

    # Apply signal intelligence adjustments
    prediction = await _apply_signal_intelligence(prediction)

    # Validate preconditions
    block_reason = _check_exec_preconditions(config, prediction)
    if block_reason:
        return {"executed": False, "reason": block_reason}

    direction = prediction.get("direction")
    confidence = prediction.get("confidence", 0)
    ccxt_symbol = _normalize_symbol(prediction.get("symbol", "BTCUSDT"))
    side = "buy" if direction == "long_bias" else "sell"
    max_usd = config.get("max_trade_usd", 0.50)

    # Scale position size by confidence and symbol multiplier
    sym_multipliers = config.get("symbol_multipliers", {})
    sym_mult = sym_multipliers.get(ccxt_symbol, 1.0)
    conf_mult = min(confidence / 0.60, 1.5)
    scaled_usd = round(max_usd * conf_mult * sym_mult, 2)

    # Fetch price and place order
    return await _place_auto_order(config, ccxt_symbol, side, scaled_usd, confidence, direction)


async def _apply_signal_intelligence(prediction: dict) -> dict:
    """Adjust prediction confidence based on historical signal accuracy data."""
    direction = prediction.get("direction")
    symbol = prediction.get("symbol", "")
    confidence = prediction.get("confidence", 0)

    # Fetch recent accuracy stats for this symbol+direction
    checked_signals = await db.signal_accuracy.find(
        {"symbol": symbol, "direction": direction, "checked": True}
    ).sort("created_at", -1).limit(50).to_list(50)

    if len(checked_signals) < 5:
        # Not enough data — return unmodified
        prediction["intelligence_applied"] = False
        return prediction

    correct = sum(1 for s in checked_signals if s.get("correct"))
    historical_wr = correct / len(checked_signals)

    # Boost or penalize confidence based on historical win rate
    # WR > 80% → boost by up to 15%, WR < 30% → penalize by up to 20%
    if historical_wr >= 0.80:
        adjustment = min((historical_wr - 0.80) * 0.75, 0.15)
        new_confidence = min(confidence + adjustment, 0.99)
    elif historical_wr <= 0.30:
        adjustment = min((0.30 - historical_wr) * 1.0, 0.20)
        new_confidence = max(confidence - adjustment, 0.05)
    else:
        new_confidence = confidence

    prediction["original_confidence"] = confidence
    prediction["confidence"] = round(new_confidence, 4)
    prediction["intelligence_applied"] = True
    prediction["historical_win_rate"] = round(historical_wr, 3)
    prediction["confidence_adjustment"] = round(new_confidence - confidence, 4)

    return prediction


def _normalize_symbol(symbol_raw: str) -> str:
    if "/" not in symbol_raw and "USDT" in symbol_raw:
        return symbol_raw.replace("USDT", "/USDT")
    if "/" not in symbol_raw and "USDC" in symbol_raw:
        return symbol_raw.replace("USDC", "/USDC")
    return symbol_raw


def _check_exec_preconditions(config: dict, prediction: dict) -> str:
    """Returns a block reason string, or empty string if all checks pass."""
    if not config.get("enabled"):
        return "auto_exec_disabled"
    if not bgx.is_configured():
        return "bitget_not_configured"

    direction = prediction.get("direction")
    confidence = prediction.get("confidence", 0)
    ccxt_symbol = _normalize_symbol(prediction.get("symbol", "BTCUSDT"))

    if direction == "wait":
        return "prediction_is_wait"
    if direction not in config.get("allowed_directions", ["long_bias", "short_bias"]):
        return f"direction_{direction}_not_allowed"

    # Quiet hours check (UTC)
    current_hour_utc = datetime.now(timezone.utc).hour
    quiet_hours = config.get("quiet_hours_utc", [])
    if current_hour_utc in quiet_hours:
        return f"quiet_hour_{current_hour_utc}utc"

    if confidence < config.get("min_confidence", 0.60):
        return f"confidence_{confidence}_below_threshold_{config['min_confidence']}"
    if ccxt_symbol not in config.get("allowed_symbols", []):
        return f"symbol_{ccxt_symbol}_not_allowed"

    # Cooldown check
    last_ts = config.get("last_trade_ts")
    if last_ts:
        try:
            last_dt = ensure_utc(last_ts)
            if last_dt:
                elapsed = (datetime.now(timezone.utc) - last_dt).total_seconds()
                cooldown = config.get("cooldown_seconds", 300)
                if elapsed < cooldown:
                    return f"cooldown_active_{int(cooldown - elapsed)}s_remaining"
        except (ValueError, TypeError) as e:
            logger.warning(f"Cooldown parse error: {e}")

    return ""


async def _place_auto_order(config, ccxt_symbol, side, max_usd, confidence, direction):
    """Fetch price, place order, log trade, broadcast."""
    try:
        ticker = await bgx.fetch_ticker(ccxt_symbol, config.get("market_type", "spot"))
        price = ticker.get("last", 0)
        if not price or price <= 0:
            return {"executed": False, "reason": "could_not_fetch_price"}
    except Exception as e:
        return {"executed": False, "reason": f"ticker_error_{str(e)[:50]}"}

    quantity = round(max_usd / price, 8)
    if quantity <= 0:
        return {"executed": False, "reason": "quantity_too_small"}

    order = None
    try:
        order = await bgx.create_order(
            ccxt_symbol, side, "market", quantity,
            market_type=config.get("market_type", "spot"),
            params={"cost": max_usd} if side == "buy" else None
        )
        if "error" in order:
            return {"executed": False, "reason": f"order_error_{order['error'][:80]}"}
    except Exception as e:
        logger.error(f"Auto-exec order failed: {e}")
        return {"executed": False, "reason": f"execution_error_{str(e)[:80]}"}

    # Success path — log and broadcast
    await update_auto_exec_config({
        "last_trade_ts": datetime.now(timezone.utc).isoformat(),
        "total_trades": config.get("total_trades", 0) + 1,
    })

    trade_record = {
        "source": "dungeon_auto_exec", "symbol": ccxt_symbol, "side": side,
        "quantity": quantity, "price": price, "notional_usd": max_usd,
        "confidence": confidence, "direction": direction,
        "order_id": order.get("id"), "order_status": order.get("status"),
        "created_at": datetime.now(timezone.utc)
    }
    await db.auto_exec_trades.insert_one(trade_record)

    await ws_manager.broadcast({"type": "auto_exec_trade", "data": {
        "symbol": ccxt_symbol, "side": side, "quantity": quantity,
        "price": price, "confidence": confidence, "direction": direction,
        "order_id": order.get("id"), "status": order.get("status"),
    }})

    for uid in list(ws_manager.active_connections.keys()):
        await notify_user(uid, "Auto-Trade Executed",
            f"SWARM {side.upper()} {ccxt_symbol} — Qty: {quantity} @ ${price:,.2f} (Conf: {confidence*100:.0f}%)",
            "success")

    return {"executed": True, "order": order, "trade": trade_record}

# --- Scheduler ---

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

    # Apply signal intelligence
    result = await _apply_signal_intelligence(result)

    logger.info(f"[SCHEDULER] {sym}: {result['direction']} conf={result['confidence']:.3f}" +
                (f" (intel: WR={result.get('historical_win_rate',0):.1%} adj={result.get('confidence_adjustment',0):+.3f})" if result.get('intelligence_applied') else ""))

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


# ============== WEBSOCKET TOKEN + ENDPOINT ==============

@api_router.get("/ws-token")
async def get_ws_token(request: Request):
    """Generate a short-lived token for WebSocket authentication."""
    user = await get_current_user(request)
    payload = {
        "sub": user["_id"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "type": "ws"
    }
    token = pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)
    return {"token": token}

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return
    except pyjwt.InvalidTokenError:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong for keep-alive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)

# Include router
# ============== REGISTER EXTRACTED ROUTERS ==============
# Imported at the bottom of the module so that all shared helpers/state
# (db, ws_manager, get_current_user, notify_user, models, etc.) are already
# defined when the router modules execute `from server import ...`.
from routes import auth as _auth_routes  # noqa: E402
from routes import exchange as _exchange_routes  # noqa: E402
from routes import scheduler as _scheduler_routes  # noqa: E402
from routes import profile as _profile_routes  # noqa: E402
from routes import notifications as _notif_routes  # noqa: E402
from routes import payments as _payment_routes  # noqa: E402
from routes import signals as _signal_routes  # noqa: E402
from routes import engine as _engine_routes  # noqa: E402
from routes import dungeon as _dungeon_routes  # noqa: E402

for _r in (_auth_routes, _exchange_routes, _scheduler_routes, _profile_routes,
           _notif_routes, _payment_routes, _signal_routes, _engine_routes, _dungeon_routes):
    api_router.include_router(_r.router)

app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.agents.create_index("user_id")
    await db.validation_runs.create_index("ts")
    await db.notifications.create_index("user_id")
    await db.payment_transactions.create_index("session_id")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.agent_performance.create_index("agent_id")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@mirofish.io")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Admin", "role": "admin",
            "telegram_chat_id": None, "email_notifications": True, "telegram_notifications": True,
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")

    await get_gate_state()

    # Start scheduler background task
    global _scheduler_task
    _scheduler_task = asyncio.create_task(scheduler_loop())
    logger.info("Scheduler background task started")

    # Index for scheduler runs
    await db.scheduler_runs.create_index("created_at")
    await db.auto_exec_trades.create_index("created_at")
    await db.signal_accuracy.create_index("created_at")
    await db.signal_accuracy.create_index("checked")

    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"""# MiroFish Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

## Telegram Bot
- Bot: @TraderGMONYbot
- Link endpoint: POST /api/telegram/link
- Test endpoint: POST /api/telegram/test
""")
    logger.info("Test credentials written")

@app.on_event("shutdown")
async def shutdown_db_client():
    global _scheduler_task
    if _scheduler_task:
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass
    client.close()
