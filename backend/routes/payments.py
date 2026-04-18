"""Stripe payments routes. Also hosts SUBSCRIPTION_PLANS table."""
import os
from datetime import UTC, datetime

from emergentintegrations.payments.stripe.checkout import (
    CheckoutSessionRequest,
    StripeCheckout,
)
from fastapi import APIRouter, HTTPException, Request

from server import CreateCheckoutRequest, db, get_current_user, logger, notify_user

router = APIRouter()

# ============== PAYMENTS ROUTES ==============

SUBSCRIPTION_PLANS = {
    "starter": {"name": "Starter", "amount": 29.00, "agents": 3, "features": ["3 Trading Agents", "Basic Analytics", "Email Support"]},
    "pro": {"name": "Pro", "amount": 99.00, "agents": 10, "features": ["10 Trading Agents", "Advanced Analytics", "Priority Support", "AI Insights"]},
    "enterprise": {"name": "Enterprise", "amount": 299.00, "agents": 50, "features": ["50 Trading Agents", "Full Analytics Suite", "24/7 Support", "AI Insights", "Custom Strategies"]}
}

@router.get("/payments/plans")
async def get_plans():
    return {"plans": SUBSCRIPTION_PLANS}

@router.post("/payments/checkout")
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
        amount=plan["amount"], currency="usd",
        success_url=success_url, cancel_url=cancel_url,
        metadata={"user_id": user["_id"], "plan": data.plan},
        payment_methods=["card", "crypto"]
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id, "user_id": user["_id"],
        "plan": data.plan, "amount": plan["amount"], "currency": "usd",
        "payment_status": "pending", "created_at": datetime.now(UTC)
    })
    return {"url": session.url, "session_id": session.session_id}

@router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        msg = str(e).lower()
        # Stripe returns a 404-like error when the session does not exist
        if "no such checkout" in msg or "resource_missing" in msg or "not found" in msg:
            raise HTTPException(status_code=404, detail="Checkout session not found")
        # Any other failure from Stripe is a bad request from the client's perspective
        raise HTTPException(status_code=400, detail=f"Invalid session: {e}")
    if status.payment_status == "paid":
        existing = await db.payment_transactions.find_one({"session_id": session_id})
        if existing and existing.get("payment_status") != "completed":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "completed", "completed_at": datetime.now(UTC)}}
            )
            if existing.get("user_id"):
                await notify_user(existing["user_id"], "Payment Successful", f"Your {existing.get('plan', '')} subscription is now active!", "success")
    return {
        "status": status.status, "payment_status": status.payment_status,
        "amount_total": status.amount_total, "currency": status.currency
    }

@router.post("/webhook/stripe")
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
