from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from app.db import init_db
from app.api.health import router as health_router
from app.api.validation import router as validation_router

app = FastAPI(title="MiroFish v12.8 Exchange Validation Pack", version="12.8.0")

@app.on_event("startup")
def startup():
    init_db()

app.include_router(health_router)
app.include_router(validation_router, prefix="/api/validation")

@app.get("/", response_class=HTMLResponse)
def home():
    return open("app/static/index.html", "r", encoding="utf-8").read()
