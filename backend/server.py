from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
import json
import random
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
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

# JWT Token management
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

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
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Create apps
app = FastAPI(title="MiroFish Mobile API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str

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

# ============== VALIDATION ENGINE ==============

# Settings for validation
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

async def validate_fill(symbol: str, exchange: str, expected_price: float, actual_price: float, expected_fee_bps: float, actual_fee_bps: float):
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
        "symbol": symbol,
        "exchange": exchange,
        "mode": gate["mode"],
        "expected_price": expected_price,
        "actual_price": actual_price,
        "expected_fee_bps": expected_fee_bps,
        "actual_fee_bps": actual_fee_bps,
        "drift_pct": round(drift_pct, 4),
        "slippage_bps": round(slippage_bps, 4),
        "passed": passed,
        "reasons": reasons
    }
    await db.validation_runs.insert_one(run_doc)
    
    if not passed:
        await set_gate_state(gate["mode"], True, ",".join(reasons))
    
    return {
        "symbol": symbol,
        "exchange": exchange,
        "drift_pct": round(drift_pct, 4),
        "slippage_bps": round(slippage_bps, 4),
        "passed": passed,
        "reasons": reasons,
        "gate": await get_gate_state(),
    }

async def get_validation_summary():
    runs = await db.validation_runs.find({}, {"_id": 0}).sort("ts", -1).limit(200).to_list(200)
    total = len(runs)
    passed = sum(1 for r in runs if r.get("passed"))
    failed = total - passed
    return {"total_runs": total, "passed": passed, "failed": failed, "gate": await get_gate_state()}

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"id": user_id, "email": email, "name": data.name, "role": "user"}

@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response, request: Request):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"id": user_id, "email": email, "name": user["name"], "role": user.get("role", "user")}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        access_token = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ============== VALIDATION ROUTES ==============

@api_router.get("/validation/gate")
async def get_gate():
    return await get_gate_state()

@api_router.post("/validation/gate")
async def update_gate(data: GateUpdateInput, request: Request):
    await get_current_user(request)
    return await set_gate_state(data.mode, data.blocked, data.reason)

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

@api_router.get("/agents")
async def get_agents(request: Request):
    user = await get_current_user(request)
    agents = await db.agents.find({"user_id": user["_id"]}, {"_id": 0, "user_id": 0}).to_list(100)
    return {"agents": agents}

@api_router.post("/agents")
async def create_agent(data: AgentCreate, request: Request):
    user = await get_current_user(request)
    agent_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "name": data.name,
        "strategy": data.strategy,
        "exchange": data.exchange,
        "trading_pairs": data.trading_pairs,
        "risk_level": data.risk_level,
        "status": "active",
        "pnl": round(random.uniform(-500, 2000), 2),
        "win_rate": round(random.uniform(0.45, 0.75), 2),
        "total_trades": random.randint(10, 500),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.agents.insert_one(agent_doc)
    return {k: v for k, v in agent_doc.items() if k != "_id" and k != "user_id"}

@api_router.patch("/agents/{agent_id}/toggle")
async def toggle_agent(agent_id: str, request: Request):
    user = await get_current_user(request)
    agent = await db.agents.find_one({"id": agent_id, "user_id": user["_id"]})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    new_status = "paused" if agent["status"] == "active" else "active"
    await db.agents.update_one({"id": agent_id}, {"$set": {"status": new_status}})
    return {"status": new_status}

@api_router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.agents.delete_one({"id": agent_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
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
        api_key=api_key,
        session_id=f"insight-{uuid.uuid4()}",
        system_message=system_message
    ).with_model("openai", "gpt-4o")
    
    prompt = data.prompt
    if data.context:
        prompt = f"Context: {data.context}\n\nQuestion: {data.prompt}"
    
    user_message = UserMessage(text=prompt)
    response = await chat.send_message(user_message)
    
    return {"insight": response, "timestamp": datetime.now(timezone.utc).isoformat()}

# ============== PAYMENTS ROUTES ==============

SUBSCRIPTION_PLANS = {
    "starter": {"name": "Starter", "amount": 29.00, "agents": 3, "features": ["3 Trading Agents", "Basic Analytics", "Email Support"]},
    "pro": {"name": "Pro", "amount": 99.00, "agents": 10, "features": ["10 Trading Agents", "Advanced Analytics", "Priority Support", "AI Insights"]},
    "enterprise": {"name": "Enterprise", "amount": 299.00, "agents": 50, "features": ["50 Trading Agents", "Full Analytics Suite", "24/7 Support", "AI Insights", "Custom Strategies"]}
}

@api_router.get("/payments/plans")
async def get_plans():
    return {"plans": SUBSCRIPTION_PLANS}

@api_router.post("/payments/checkout")
async def create_checkout(data: CreateCheckoutRequest, request: Request):
    user = await get_current_user(request)
    
    if data.plan not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    plan = SUBSCRIPTION_PLANS[data.plan]
    api_key = os.environ.get("STRIPE_API_KEY")
    
    webhook_url = f"{data.origin_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{data.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/payment/cancel"
    
    checkout_request = CheckoutSessionRequest(
        amount=plan["amount"],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user["_id"], "plan": data.plan},
        payment_methods=["card", "crypto"]
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Store transaction
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["_id"],
        "plan": data.plan,
        "amount": plan["amount"],
        "currency": "usd",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction
    if status.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "completed", "completed_at": datetime.now(timezone.utc)}}
        )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        event = await stripe_checkout.handle_webhook(body, signature)
        logger.info(f"Stripe webhook event: {event.event_type}")
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"received": True}

# ============== NOTIFICATIONS ROUTES ==============

@api_router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    notifications = await db.notifications.find(
        {"user_id": user["_id"]},
        {"_id": 0, "user_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {"notifications": notifications}

@api_router.post("/notifications")
async def create_notification(data: NotificationCreate, request: Request):
    user = await get_current_user(request)
    notif_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "title": data.title,
        "message": data.message,
        "type": data.type,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif_doc)
    return {k: v for k, v in notif_doc.items() if k != "_id" and k != "user_id"}

@api_router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, request: Request):
    user = await get_current_user(request)
    await db.notifications.update_one(
        {"id": notif_id, "user_id": user["_id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Marked as read"}

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
    
    return {
        "total_agents": len(agents),
        "active_agents": active_agents,
        "total_pnl": round(total_pnl, 2),
        "avg_win_rate": round(avg_win_rate * 100, 1),
        "total_trades": total_trades,
        "validation_summary": validation
    }

# ============== HEALTH ==============

@api_router.get("/")
async def root():
    return {"message": "MiroFish API v1.0.0", "status": "operational"}

@api_router.get("/health")
async def health():
    return {"status": "ok", "validation": await get_validation_summary()}

# Include router
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
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.agents.create_index("user_id")
    await db.validation_runs.create_index("ts")
    await db.notifications.create_index("user_id")
    await db.payment_transactions.create_index("session_id")
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@mirofish.io")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    
    # Initialize gate
    await get_gate_state()
    
    # Write test credentials
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
""")
    logger.info("Test credentials written to /app/memory/test_credentials.md")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
