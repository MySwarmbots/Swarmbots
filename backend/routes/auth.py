"""
Auth routes: register, login, logout, me, refresh, forgot-password, reset-password.

Shared state (db, helpers, models) is imported from `server` — this works because
`server.py` imports this module AFTER defining those names, breaking the cycle.
"""
import secrets
from datetime import UTC, datetime, timedelta

import jwt as pyjwt
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, Response

from server import (
    JWT_ALGORITHM,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserLogin,
    UserRegister,
    build_email_html,
    create_access_token,
    create_refresh_token,
    db,
    ensure_utc,
    get_current_user,
    get_jwt_secret,
    hash_password,
    logger,
    send_email,
    send_telegram_message,
    verify_password,
)

router = APIRouter()


@router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "email": email, "password_hash": hash_password(data.password),
        "name": data.name, "role": "user",
        "telegram_chat_id": None, "email_notifications": True, "telegram_notifications": True,
        "created_at": datetime.now(UTC)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"id": user_id, "email": email, "name": data.name, "role": "user"}


@router.post("/auth/login")
async def login(data: UserLogin, response: Response, request: Request):
    email = data.email.lower().strip()
    # Brute force check
    identifier = f"{request.client.host}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        last_attempt = ensure_utc(attempt.get("last_attempt")) or datetime.min.replace(tzinfo=UTC)
        lockout_until = last_attempt + timedelta(minutes=15)
        if datetime.now(UTC) < lockout_until:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        # Increment failed attempts
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(UTC)}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Clear failed attempts on success
    await db.login_attempts.delete_one({"identifier": identifier})
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"id": user_id, "email": email, "name": user["name"], "role": user.get("role", "user")}


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}


@router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user


@router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access_token = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed"}
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


# ============== PASSWORD RESET ==============

@router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        # Don't reveal if user exists
        return {"message": "If an account exists with this email, a reset link has been sent."}

    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": str(user["_id"]),
        "email": email,
        "expires_at": datetime.now(UTC) + timedelta(hours=1),
        "used": False,
        "created_at": datetime.now(UTC)
    })

    reset_link = f"/reset-password?token={token}"
    logger.info(f"[PASSWORD RESET] Email: {email} | Reset link: {reset_link}")

    # Send email with reset link
    reset_html = build_email_html(
        "Password Reset Request",
        f"Use this token to reset your password:<br><br>"
        f"<code style='background:#0A0A0A;padding:8px 12px;color:#00FF66;font-size:13px;display:inline-block;word-break:break-all;'>{token}</code><br><br>"
        f"This token expires in 1 hour. If you did not request this reset, ignore this email.",
        "warning"
    )
    await send_email(email, "[MiroFish] Password Reset", reset_html)

    # Also send via Telegram if connected
    if user.get("telegram_chat_id"):
        await send_telegram_message(
            user["telegram_chat_id"],
            f"🔑 <b>Password Reset Request</b>\nUse this token to reset your password:\n<code>{token}</code>"
        )

    return {"message": "If an account exists with this email, a reset link has been sent.", "reset_token": token}


@router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    token_doc = await db.password_reset_tokens.find_one({"token": data.token})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if token_doc.get("used"):
        raise HTTPException(status_code=400, detail="Reset token already used")
    if datetime.now(UTC) > ensure_utc(token_doc["expires_at"]):
        raise HTTPException(status_code=400, detail="Reset token has expired")

    new_hash = hash_password(data.new_password)
    await db.users.update_one({"_id": ObjectId(token_doc["user_id"])}, {"$set": {"password_hash": new_hash}})
    await db.password_reset_tokens.update_one({"token": data.token}, {"$set": {"used": True}})

    return {"message": "Password has been reset successfully"}
