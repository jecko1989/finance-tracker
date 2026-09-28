import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture()
def db_session():
    from app.db.base import Base

    # StaticPool: FastAPI runs sync route handlers in a worker thread, not the
    # test's thread. The default SQLite pool binds one connection per thread,
    # so the handler would see a different (empty) :memory: database. StaticPool
    # keeps a single shared connection across every thread for this engine.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)
    session = testing_session_local()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    from app.api.deps import get_db
    from app.main import app

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client, db_session):
    from app.core.security import hash_password
    from app.models.user import User

    user = User(username="testuser", password_hash=hash_password("testpass"))
    db_session.add(user)
    db_session.commit()

    response = client.post("/auth/login", json={"username": "testuser", "password": "testpass"})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
