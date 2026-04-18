"""Profile + Telegram link routes."""
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request

from server import ProfileUpdate, TelegramLinkRequest, db, get_current_user, send_telegram_message

router = APIRouter()

# ============== PROFILE / TELEGRAM LINK ==============

@router.get("/profile")
async def get_profile(request: Request):
    user = await get_current_user(request)
    return {
        "id": user["_id"],
        "email": user.get("email"),
        "name": user.get("name"),
        "role": user.get("role"),
        "telegram_chat_id": user.get("telegram_chat_id"),
        "email_notifications": user.get("email_notifications", True),
        "telegram_notifications": user.get("telegram_notifications", True),
    }

@router.patch("/profile")
async def update_profile(data: ProfileUpdate, request: Request):
    user = await get_current_user(request)
    updates = {}
    if data.name is not None:
        updates["name"] = data.name
    if data.telegram_chat_id is not None:
        updates["telegram_chat_id"] = data.telegram_chat_id
    if data.email_notifications is not None:
        updates["email_notifications"] = data.email_notifications
    if data.telegram_notifications is not None:
        updates["telegram_notifications"] = data.telegram_notifications
    if updates:
        await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": updates})
    return {"message": "Profile updated"}

@router.post("/telegram/link")
async def link_telegram(data: TelegramLinkRequest, request: Request):
    user = await get_current_user(request)
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"telegram_chat_id": data.chat_id}})
    # Send verification
    success = await send_telegram_message(data.chat_id, f"✅ <b>MiroFish Connected!</b>\nHello {user.get('name', 'Trader')}, your Telegram is now linked to MiroFish. You'll receive trading alerts here.")
    if not success:
        raise HTTPException(status_code=400, detail="Failed to send verification. Check your Chat ID.")
    return {"message": "Telegram linked successfully"}

@router.post("/telegram/unlink")
async def unlink_telegram(request: Request):
    user = await get_current_user(request)
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"telegram_chat_id": None}})
    return {"message": "Telegram unlinked"}

@router.post("/telegram/test")
async def test_telegram(request: Request):
    user = await get_current_user(request)
    full_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if not full_user or not full_user.get("telegram_chat_id"):
        raise HTTPException(status_code=400, detail="Telegram not linked")
    success = await send_telegram_message(
        full_user["telegram_chat_id"],
        "🧪 <b>Test Notification</b>\nThis is a test message from MiroFish. Your notifications are working!"
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send test message")
    return {"message": "Test message sent"}
