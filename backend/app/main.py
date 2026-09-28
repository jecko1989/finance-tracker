from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, health
from app.core.config import get_settings
from app.db.init_db import bootstrap_admin, init_db
from app.db.session import SessionLocal, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(engine)
    db = SessionLocal()
    try:
        bootstrap_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Finance Tracker", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origins] if settings.cors_origins != "*" else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
