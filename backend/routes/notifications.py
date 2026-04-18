"""Notifications routes."""
from fastapi import APIRouter, Request

from server import db, get_current_user, notify_user, NotificationCreate

router = APIRouter()

# ============== NOTIFICATIONS ROUTES ==============

@router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    notifications = await db.notifications.find(
        {"user_id": user["_id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {"notifications": notifications}

@router.get("/notifications/unread-count")
async def get_unread_count(request: Request):
    user = await get_current_user(request)
    count = await db.notifications.count_documents({"user_id": user["_id"], "read": False})
    return {"count": count}

@router.post("/notifications")
async def create_notification(data: NotificationCreate, request: Request):
    user = await get_current_user(request)
    await notify_user(user["_id"], data.title, data.message, data.type)
    return {"message": "Notification created"}

@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, request: Request):
    user = await get_current_user(request)
    await db.notifications.update_one({"id": notif_id, "user_id": user["_id"]}, {"$set": {"read": True}})
    return {"message": "Marked as read"}

@router.post("/notifications/mark-all-read")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    await db.notifications.update_many({"user_id": user["_id"], "read": False}, {"$set": {"read": True}})
    return {"message": "All marked as read"}
