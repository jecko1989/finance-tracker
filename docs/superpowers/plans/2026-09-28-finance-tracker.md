# Finance Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user webapp to track income/expenses across independent "projects", with per-project balance, two trend charts, a cross-project recent-transactions recap on login, and Docker Compose deploy to `raspi-gorghy` over Tailscale with manual (workflow_dispatch) CI/CD.

**Architecture:** FastAPI + SQLAlchemy 2.0 + SQLite backend (routes → services → models/schemas, JWT auth, single bootstrap admin) and a React 18 + Vite + TypeScript + Tailwind + Recharts frontend (typed `api.ts` client, hooks for fetch/state, no external state manager). Backend and frontend are built and tested independently, then wired together with Docker Compose and an Nginx reverse proxy (`/api` relative path, no rebuild needed to change host).

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, SQLite, PyJWT, bcrypt, pytest, httpx — React 18, Vite, TypeScript, Tailwind CSS, Recharts, react-router-dom, Vitest, Testing Library — Docker Compose, GitHub Actions (`tailscale/github-action`).

**Spec:** `docs/superpowers/specs/2026-09-28-finance-tracker-design.md`

## Global Constraints

- Repo is public: no personal identifiers (username, real Pi hostname beyond the placeholder, real project names) in code, README, commit messages, class/variable names, or comments. Real project names ("Stignano", etc.) only ever exist as runtime data the user types in.
- UI strings, error messages, and code comments are in Italian (matches sibling project convention).
- `Project.owner_id` exists from the start (multi-user-ready schema) but no registration/permission UI is built now — single bootstrap admin only, from `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars.
- No new dependency beyond what's listed in Tech Stack; no external state manager, no ORM beyond SQLAlchemy, no ui component library.
- Deploy is Docker Compose only; CI/CD trigger is `workflow_dispatch` only — **never** `push`/`pull_request` (public repo, Tailscale OAuth secrets).
- Money fields (`amount`, `balance`, `income`, `expense`) are `Decimal` server-side and serialize to **JSON strings** (Pydantic v2 default) — frontend types must be `string` for these fields and convert with `Number(...)` before arithmetic/formatting. This was verified empirically (see Task 5) and is not optional/interpretive.

## Review Focus

- A project with transactions gets deleted: the transactions must actually be gone from the database afterward, not just detached in the ORM session (cascade must be verified against a fresh query, not the same session's identity map) — covered in Task 4.
- An expired JWT must be rejected with 401, not accepted — covered in Task 3.
- A user must not be able to read/modify/delete another user's projects or their nested transactions — covered in Task 4 and Task 5.
- An amount entered with more than 2 decimals (e.g. `10.999`) must be normalized consistently, not left to SQLite's dynamic typing to mangle — covered in Task 5.
- A project or detail view with zero transactions must render an empty-state message, not crash the charts or the list — covered in Task 13 and Task 14.

---

## Task 1: Backend scaffolding

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/app/__init__.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/routes/__init__.py`
- Create: `backend/app/api/routes/health.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`
- Create: `.gitignore` (repo root)

**Interfaces:**
- Produces: `get_settings() -> Settings` (`app/core/config.py`), FastAPI `app` instance (`app/main.py`), `GET /health -> {"status": "ok"}`, pytest fixtures `client` and `db_session` (used by every later backend task).

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# Python
__pycache__/
*.pyc
.venv/
*.db

# Node
node_modules/
dist/

# Env
.env
*.env
!.env.example
```

- [ ] **Step 2: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
pydantic==2.9.2
pydantic-settings==2.5.2
pyjwt==2.9.0
bcrypt==4.2.0
httpx==0.27.2
pytest==8.3.3
```

- [ ] **Step 3: Create `backend/pytest.ini`**

```ini
[pytest]
pythonpath = .
```

- [ ] **Step 4: Create empty `__init__.py` files**

Create `backend/app/__init__.py`, `backend/app/core/__init__.py`, `backend/app/api/__init__.py`, `backend/app/api/routes/__init__.py` — all empty.

- [ ] **Step 5: Create `backend/app/core/config.py`**

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./finance_tracker.db"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    admin_username: str = "admin"
    admin_password: str = "admin"
    cors_origins: str = "*"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 6: Create `backend/app/api/routes/health.py`**

```python
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 7: Create `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.core.config import get_settings

app = FastAPI(title="Finance Tracker")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origins] if settings.cors_origins != "*" else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
```

- [ ] **Step 8: Create `backend/tests/conftest.py`**

Sets `DATABASE_URL` to an in-memory SQLite before `app.main` is ever imported (avoids polluting the repo with a stray `finance_tracker.db` file when running pytest), and provides the `client`/`db_session` fixtures every later backend test task depends on.

```python
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture()
def db_session():
    from app.db.base import Base

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
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
```

Note: `db_session` and `auth_headers` reference `app.db.base`, `app.api.deps`, `app.core.security`, `app.models.user` which don't exist yet — this fixture file is created now but `db_session`/`auth_headers` only become usable starting Task 2/3. `test_health.py` (Step 9) only uses `client`, whose imports (`app.api.deps.get_db`) also don't exist yet, so **Step 9's test intentionally only exercises `/health` and doesn't need `get_db`** — adjust `client` fixture in this step to not import `get_db` yet:

Rewrite the `client` fixture for this task only as:

```python
@pytest.fixture()
def client(db_session):
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
```

(No `get_db` override yet — Task 2 will add the DB dependency and Task 3's version of this file replaces this fixture with the full override shown above once `app.api.deps.get_db` exists.)

- [ ] **Step 9: Create `backend/tests/test_health.py`**

```python
def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 10: Install deps and run the test**

```bash
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest -v
```

Expected: `test_health_ok` PASSES.

- [ ] **Step 11: Commit**

```bash
git add .gitignore backend/requirements.txt backend/pytest.ini backend/app backend/tests
git commit -m "feat(backend): scaffold FastAPI app with health endpoint"
```

---

## Task 2: User model, security utils, DB bootstrap

**Files:**
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/base.py`
- Create: `backend/app/db/session.py`
- Create: `backend/app/db/init_db.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/core/security.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_security.py`
- Create: `backend/tests/test_bootstrap.py`

**Interfaces:**
- Consumes: `get_settings()` (Task 1).
- Produces: `hash_password(password: str) -> str`, `verify_password(password: str, hashed: str) -> bool`, `create_access_token(subject: str) -> str`, `decode_access_token(token: str) -> str | None`, `init_db(engine) -> None`, `bootstrap_admin(db: Session) -> None`, `User` model (`id`, `username`, `password_hash`, `created_at`) — all consumed by Task 3 onward.

- [ ] **Step 1: Create `backend/app/db/__init__.py`** (empty)

- [ ] **Step 2: Create `backend/app/db/base.py`**

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 3: Create `backend/app/db/session.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings

settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
```

- [ ] **Step 4: Create `backend/app/models/__init__.py`**

```python
from app.models.user import User

__all__ = ["User"]
```

- [ ] **Step 5: Create `backend/app/models/user.py`**

```python
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

- [ ] **Step 6: Write the failing tests for security utils**

Create `backend/tests/test_security.py`:

```python
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_hash_and_verify_password():
    hashed = hash_password("s3cret")
    assert hashed != "s3cret"
    assert verify_password("s3cret", hashed)
    assert not verify_password("wrong", hashed)


def test_create_and_decode_token():
    token = create_access_token("alice")
    assert decode_access_token(token) == "alice"


def test_decode_invalid_token_returns_none():
    assert decode_access_token("not-a-token") is None


def test_decode_expired_token_returns_none():
    settings = get_settings()
    expired_payload = {
        "sub": "alice",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    assert decode_access_token(expired_token) is None
```

- [ ] **Step 7: Run to verify it fails**

Run: `cd backend && pytest tests/test_security.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.core.security'`

- [ ] **Step 8: Create `backend/app/core/security.py`**

```python
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    return payload.get("sub")
```

- [ ] **Step 9: Run to verify it passes**

Run: `cd backend && pytest tests/test_security.py -v`
Expected: 4 PASSED

- [ ] **Step 10: Write the failing tests for bootstrap**

Create `backend/tests/test_bootstrap.py`:

```python
from app.db.init_db import bootstrap_admin
from app.models.user import User


def test_bootstrap_creates_admin_when_no_users(db_session):
    bootstrap_admin(db_session)
    users = db_session.query(User).all()
    assert len(users) == 1
    assert users[0].username == "admin"


def test_bootstrap_is_noop_if_user_exists(db_session):
    bootstrap_admin(db_session)
    bootstrap_admin(db_session)
    assert db_session.query(User).count() == 1
```

- [ ] **Step 11: Run to verify it fails**

Run: `cd backend && pytest tests/test_bootstrap.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.db.init_db'`

- [ ] **Step 12: Create `backend/app/db/init_db.py`**

```python
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.user import User


def init_db(engine: Engine) -> None:
    from app.db.base import Base

    Base.metadata.create_all(engine)


def bootstrap_admin(db: Session) -> None:
    settings = get_settings()
    existing = db.query(User).first()
    if existing is not None:
        return
    admin = User(
        username=settings.admin_username,
        password_hash=hash_password(settings.admin_password),
    )
    db.add(admin)
    db.commit()
```

- [ ] **Step 13: Run to verify it passes**

Run: `cd backend && pytest tests/test_bootstrap.py -v`
Expected: 2 PASSED

- [ ] **Step 14: Wire startup lifespan into `backend/app/main.py`**

Replace the file content with:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
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
```

- [ ] **Step 15: Run the full suite**

Run: `cd backend && pytest -v`
Expected: all PASS (the `client` fixture from Task 1 still doesn't override `get_db` yet — that's fine, `/health` doesn't touch the DB; the real DB file is never created because `conftest.py` sets `DATABASE_URL=sqlite:///:memory:`).

- [ ] **Step 16: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat(backend): add user model, security utils, DB bootstrap"
```

---

## Task 3: Auth API

**Files:**
- Create: `backend/app/api/deps.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/auth_service.py`
- Create: `backend/app/api/routes/auth.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py`
- Create: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `hash_password`, `verify_password`, `create_access_token`, `decode_access_token` (Task 2), `User` model (Task 2).
- Produces: `get_db()` and `get_current_user(...) -> User` dependencies (used by every protected route from here on), `POST /auth/login`, `POST /auth/change-password`.

- [ ] **Step 1: Create `backend/app/api/deps.py`**

```python
from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.user import User

bearer_scheme = HTTPBearer()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    username = decode_access_token(credentials.credentials)
    if username is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token non valido")
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utente non trovato")
    return user
```

- [ ] **Step 2: Create `backend/app/schemas/__init__.py`** (empty) **and `backend/app/schemas/auth.py`**

```python
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
```

- [ ] **Step 3: Create `backend/app/services/__init__.py`** (empty) **and `backend/app/services/auth_service.py`**

```python
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def login(db: Session, username: str, password: str) -> str:
    user = authenticate_user(db, username, password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide")
    return create_access_token(user.username)


def change_password(db: Session, user: User, old_password: str, new_password: str) -> None:
    if not verify_password(old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Password attuale non corretta")
    user.password_hash = hash_password(new_password)
    db.commit()
```

- [ ] **Step 4: Create `backend/app/api/routes/auth.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    token = auth_service.login(db, payload.username, payload.password)
    return TokenResponse(access_token=token)


@router.post("/change-password", status_code=204)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    auth_service.change_password(db, current_user, payload.old_password, payload.new_password)
```

- [ ] **Step 5: Register the router in `backend/app/main.py`**

Add `from app.api.routes import auth, health` (replace the `health`-only import) and `app.include_router(auth.router)` after `app.include_router(health.router)`.

- [ ] **Step 6: Replace `backend/tests/conftest.py`'s `client` fixture with the full version**

Replace the Task-1 version of the `client` fixture (the one without `get_db` override) with:

```python
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
```

(The `auth_headers` fixture already written in Task 1's conftest now works, since `app.api.deps`, `app.core.security`, `app.models.user` all exist.)

- [ ] **Step 7: Write the failing tests**

Create `backend/tests/test_auth.py`:

```python
from app.core.security import hash_password
from app.models.user import User


def test_login_success(client, db_session):
    db_session.add(User(username="bob", password_hash=hash_password("hunter2")))
    db_session.commit()

    response = client.post("/auth/login", json={"username": "bob", "password": "hunter2"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client, db_session):
    db_session.add(User(username="bob", password_hash=hash_password("hunter2")))
    db_session.commit()

    response = client.post("/auth/login", json={"username": "bob", "password": "wrong"})
    assert response.status_code == 401


def test_change_password_requires_old_password(client, auth_headers):
    response = client.post(
        "/auth/change-password",
        json={"old_password": "wrong", "new_password": "newpass"},
        headers=auth_headers,
    )
    assert response.status_code == 401


def test_change_password_success(client, auth_headers):
    response = client.post(
        "/auth/change-password",
        json={"old_password": "testpass", "new_password": "newpass"},
        headers=auth_headers,
    )
    assert response.status_code == 204

    login_response = client.post("/auth/login", json={"username": "testuser", "password": "newpass"})
    assert login_response.status_code == 200


def test_protected_endpoint_requires_token(client):
    response = client.post("/auth/change-password", json={"old_password": "a", "new_password": "b"})
    assert response.status_code in (401, 403)
```

- [ ] **Step 8: Run to verify it fails**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: FAIL (routes not registered / imports missing) before Step 4-5 are done — if run after, skip to Step 9.

- [ ] **Step 9: Run to verify it passes**

Run: `cd backend && pytest -v`
Expected: all PASSED (11 tests total across the suite so far).

- [ ] **Step 10: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat(backend): add JWT auth endpoints and get_current_user dependency"
```

---

## Task 4: Project model, service, routes

**Files:**
- Create: `backend/app/models/project.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/app/schemas/project.py`
- Create: `backend/app/services/project_service.py`
- Create: `backend/app/api/routes/projects.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_projects.py`

**Interfaces:**
- Consumes: `get_current_user`, `get_db` (Task 3).
- Produces: `Project` model, `project_service.{list_projects, create_project, update_project, delete_project, get_project_or_404, compute_balance}`, `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}` — `get_project_or_404` and `compute_balance` are consumed by Task 5, 6, 7.

- [ ] **Step 1: Create `backend/app/models/project.py`**

```python
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.transaction import Transaction


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
```

- [ ] **Step 2: Update `backend/app/models/__init__.py`**

```python
from app.models.project import Project
from app.models.user import User

__all__ = ["Project", "User"]
```

- [ ] **Step 3: Create `backend/app/schemas/project.py`**

```python
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    balance: Decimal
    created_at: datetime
```

- [ ] **Step 4: Create `backend/app/services/project_service.py`**

```python
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.transaction import Transaction


def compute_balance(db: Session, project_id: int) -> Decimal:
    total = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.project_id == project_id)
        .scalar()
    )
    # ponytail: str() guards against SQLite returning a raw float for the
    # aggregate; Decimal(float) would introduce binary-float imprecision.
    return Decimal(str(total))


def get_project_or_404(db: Session, owner_id: int, project_id: int) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == owner_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progetto non trovato")
    return project


def list_projects(db: Session, owner_id: int) -> list[tuple[Project, Decimal]]:
    projects = (
        db.query(Project).filter(Project.owner_id == owner_id).order_by(Project.created_at).all()
    )
    return [(p, compute_balance(db, p.id)) for p in projects]


def create_project(db: Session, owner_id: int, name: str) -> Project:
    project = Project(owner_id=owner_id, name=name)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, owner_id: int, project_id: int, name: str) -> Project:
    project = get_project_or_404(db, owner_id, project_id)
    project.name = name
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, owner_id: int, project_id: int) -> None:
    project = get_project_or_404(db, owner_id, project_id)
    db.delete(project)
    db.commit()
```

This file imports `app.models.transaction`, which doesn't exist until Task 5 — create a minimal placeholder now so Task 4 is runnable on its own, Task 5 will flesh it out:

- [ ] **Step 5: Create a minimal `backend/app/models/transaction.py`** (Task 5 replaces this with the full version)

```python
from datetime import date as date_
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    date: Mapped[date_] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="transactions")
```

Update `backend/app/models/__init__.py` again to also import it (needed so SQLAlchemy registers the mapper before `Base.metadata.create_all` runs):

```python
from app.models.project import Project
from app.models.transaction import Transaction
from app.models.user import User

__all__ = ["Project", "Transaction", "User"]
```

- [ ] **Step 6: Create `backend/app/api/routes/projects.py`**

```python
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[ProjectRead]:
    return [
        ProjectRead(id=p.id, name=p.name, balance=balance, created_at=p.created_at)
        for p, balance in project_service.list_projects(db, current_user.id)
    ]


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectRead:
    project = project_service.create_project(db, current_user.id, payload.name)
    return ProjectRead(id=project.id, name=project.name, balance=Decimal("0"), created_at=project.created_at)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectRead:
    project = project_service.get_project_or_404(db, current_user.id, project_id)
    balance = project_service.compute_balance(db, project.id)
    return ProjectRead(id=project.id, name=project.name, balance=balance, created_at=project.created_at)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectRead:
    project = project_service.update_project(db, current_user.id, project_id, payload.name)
    balance = project_service.compute_balance(db, project.id)
    return ProjectRead(id=project.id, name=project.name, balance=balance, created_at=project.created_at)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    project_service.delete_project(db, current_user.id, project_id)
```

- [ ] **Step 7: Register the router in `backend/app/main.py`**

Add `projects` to the routes import and `app.include_router(projects.router)`.

- [ ] **Step 8: Write the failing tests**

Create `backend/tests/test_projects.py`:

```python
from decimal import Decimal

from app.core.security import hash_password
from app.models.project import Project
from app.models.transaction import Transaction
from app.models.user import User


def test_create_and_list_projects(client, auth_headers):
    response = client.post("/projects", json={"name": "Portafoglio personale"}, headers=auth_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Portafoglio personale"
    assert body["balance"] == "0"

    response = client.get("/projects", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_update_project_name(client, auth_headers):
    create = client.post("/projects", json={"name": "Vecchio nome"}, headers=auth_headers)
    project_id = create.json()["id"]

    response = client.patch(f"/projects/{project_id}", json={"name": "Nuovo nome"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Nuovo nome"


def test_delete_project_also_deletes_its_transactions(client, db_session, auth_headers):
    create = client.post("/projects", json={"name": "Da eliminare"}, headers=auth_headers)
    project_id = create.json()["id"]

    db_session.add(Transaction(project_id=project_id, amount=Decimal("10.00"), date="2026-01-01"))
    db_session.commit()

    response = client.delete(f"/projects/{project_id}", headers=auth_headers)
    assert response.status_code == 204

    response = client.get("/projects", headers=auth_headers)
    assert response.json() == []

    # Re-query with a fresh statement (not the session's identity map) to make sure
    # the cascade actually removed the row from the database, not just from ORM state.
    remaining = db_session.query(Transaction).filter(Transaction.project_id == project_id).all()
    assert remaining == []


def test_project_not_visible_or_editable_by_another_user(client, db_session, auth_headers):
    other_user = User(username="other", password_hash=hash_password("pass"))
    db_session.add(other_user)
    db_session.commit()
    other_project = Project(owner_id=other_user.id, name="Non tuo")
    db_session.add(other_project)
    db_session.commit()

    response = client.get(f"/projects/{other_project.id}", headers=auth_headers)
    assert response.status_code == 404

    response = client.patch(f"/projects/{other_project.id}", json={"name": "x"}, headers=auth_headers)
    assert response.status_code == 404

    response = client.delete(f"/projects/{other_project.id}", headers=auth_headers)
    assert response.status_code == 404
```

- [ ] **Step 9: Run to verify it passes**

Run: `cd backend && pytest -v`
Expected: all PASSED.

- [ ] **Step 10: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat(backend): add project CRUD with owner isolation and balance calc"
```

---

## Task 5: Transaction model, service, routes

**Files:**
- Modify: `backend/app/models/transaction.py` (replace the Task-4 placeholder with the full version)
- Create: `backend/app/schemas/transaction.py`
- Create: `backend/app/services/transaction_service.py`
- Create: `backend/app/api/routes/transactions.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_transactions.py`

**Interfaces:**
- Consumes: `get_project_or_404` (Task 4).
- Produces: `Transaction` model with `note`/`category` columns, `transaction_service.{list_transactions, create_transaction, update_transaction, delete_transaction, get_transaction_or_404, suggest_categories}`, `GET/POST /projects/{project_id}/transactions`, `PATCH/DELETE /projects/{project_id}/transactions/{tx_id}` — consumed by Task 6, 7, 8.

- [ ] **Step 1: Replace `backend/app/models/transaction.py`**

```python
from datetime import date as date_
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    date: Mapped[date_] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="transactions")
```

- [ ] **Step 2: Create `backend/app/schemas/transaction.py`**

Includes an amount-quantization validator: SQLite's dynamic typing doesn't enforce `Numeric(12, 2)`'s scale, so an amount like `10.999` sent by a client must be normalized to 2 decimals at the API boundary, not left inconsistent.

```python
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class TransactionCreate(BaseModel):
    amount: Decimal
    date: date
    note: str | None = Field(default=None, max_length=500)
    category: str | None = Field(default=None, max_length=80)

    @field_validator("amount")
    @classmethod
    def quantize_amount(cls, value: Decimal) -> Decimal:
        return _quantize(value)


class TransactionUpdate(BaseModel):
    amount: Decimal | None = None
    date: date | None = None
    note: str | None = Field(default=None, max_length=500)
    category: str | None = Field(default=None, max_length=80)

    @field_validator("amount")
    @classmethod
    def quantize_amount(cls, value: Decimal | None) -> Decimal | None:
        return None if value is None else _quantize(value)


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    amount: Decimal
    date: date
    note: str | None
    category: str | None
    created_at: datetime
```

- [ ] **Step 3: Create `backend/app/services/transaction_service.py`**

```python
from datetime import date as date_

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate


def list_transactions(
    db: Session,
    project_id: int,
    from_date: date_ | None = None,
    to_date: date_ | None = None,
    category: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Transaction]:
    query = db.query(Transaction).filter(Transaction.project_id == project_id)
    if from_date is not None:
        query = query.filter(Transaction.date >= from_date)
    if to_date is not None:
        query = query.filter(Transaction.date <= to_date)
    if category is not None:
        query = query.filter(Transaction.category == category)
    return (
        query.order_by(Transaction.date.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_transaction_or_404(db: Session, project_id: int, tx_id: int) -> Transaction:
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == tx_id, Transaction.project_id == project_id)
        .first()
    )
    if tx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transazione non trovata")
    return tx


def create_transaction(db: Session, project_id: int, data: TransactionCreate) -> Transaction:
    tx = Transaction(project_id=project_id, **data.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def update_transaction(db: Session, project_id: int, tx_id: int, data: TransactionUpdate) -> Transaction:
    tx = get_transaction_or_404(db, project_id, tx_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    db.commit()
    db.refresh(tx)
    return tx


def delete_transaction(db: Session, project_id: int, tx_id: int) -> None:
    tx = get_transaction_or_404(db, project_id, tx_id)
    db.delete(tx)
    db.commit()


def suggest_categories(db: Session, project_id: int) -> list[str]:
    rows = (
        db.query(Transaction.category)
        .filter(Transaction.project_id == project_id, Transaction.category.isnot(None))
        .distinct()
        .order_by(Transaction.category)
        .all()
    )
    return [row[0] for row in rows]
```

- [ ] **Step 4: Create `backend/app/api/routes/transactions.py`**

```python
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate
from app.services import project_service, transaction_service

router = APIRouter(prefix="/projects/{project_id}/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    project_id: int,
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TransactionRead]:
    project_service.get_project_or_404(db, current_user.id, project_id)
    return transaction_service.list_transactions(
        db, project_id, from_date, to_date, category, limit, offset
    )


@router.post("", response_model=TransactionRead, status_code=201)
def create_transaction(
    project_id: int,
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionRead:
    project_service.get_project_or_404(db, current_user.id, project_id)
    return transaction_service.create_transaction(db, project_id, payload)


@router.patch("/{tx_id}", response_model=TransactionRead)
def update_transaction(
    project_id: int,
    tx_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionRead:
    project_service.get_project_or_404(db, current_user.id, project_id)
    return transaction_service.update_transaction(db, project_id, tx_id, payload)


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    project_id: int,
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    project_service.get_project_or_404(db, current_user.id, project_id)
    transaction_service.delete_transaction(db, project_id, tx_id)
```

- [ ] **Step 5: Register the router in `backend/app/main.py`**

Add `transactions` to the routes import and `app.include_router(transactions.router)`.

- [ ] **Step 6: Write the failing tests**

Create `backend/tests/test_transactions.py`:

```python
from app.core.security import hash_password
from app.models.project import Project
from app.models.user import User


def _create_project(client, auth_headers, name="Test"):
    response = client.post("/projects", json={"name": name}, headers=auth_headers)
    return response.json()["id"]


def test_create_and_list_transactions(client, auth_headers):
    project_id = _create_project(client, auth_headers)

    response = client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "100.00", "date": "2026-01-05", "note": "Stipendio", "category": "reddito"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["amount"] == "100.00"

    response = client.get(f"/projects/{project_id}/transactions", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_amount_is_quantized_to_two_decimals(client, auth_headers):
    project_id = _create_project(client, auth_headers)

    response = client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "10.999", "date": "2026-01-01"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["amount"] == "11.00"


def test_filter_transactions_by_date_and_category(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "50.00", "date": "2026-01-01", "category": "affitto"},
        headers=auth_headers,
    )
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "20.00", "date": "2026-02-01", "category": "cibo"},
        headers=auth_headers,
    )

    response = client.get(
        f"/projects/{project_id}/transactions",
        params={"category": "affitto"},
        headers=auth_headers,
    )
    assert len(response.json()) == 1
    assert response.json()[0]["category"] == "affitto"

    response = client.get(
        f"/projects/{project_id}/transactions",
        params={"from_date": "2026-02-01"},
        headers=auth_headers,
    )
    assert len(response.json()) == 1
    assert response.json()[0]["date"] == "2026-02-01"


def test_update_and_delete_transaction(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    create = client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "10.00", "date": "2026-01-01"},
        headers=auth_headers,
    )
    tx_id = create.json()["id"]

    response = client.patch(
        f"/projects/{project_id}/transactions/{tx_id}",
        json={"amount": "-5.00"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["amount"] == "-5.00"

    response = client.delete(f"/projects/{project_id}/transactions/{tx_id}", headers=auth_headers)
    assert response.status_code == 204


def test_suggest_categories_empty_when_no_transactions(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    response = client.get(f"/projects/{project_id}/categories/suggest", headers=auth_headers)
    # Route doesn't exist yet (added in Task 7) — this test is added here as a
    # placeholder reminder and is skipped until Task 7 registers the route.
    assert response.status_code in (200, 404)


def test_transactions_not_accessible_for_other_users_project(client, db_session, auth_headers):
    other_user = User(username="other", password_hash=hash_password("pass"))
    db_session.add(other_user)
    db_session.commit()
    other_project = Project(owner_id=other_user.id, name="Non tuo")
    db_session.add(other_project)
    db_session.commit()

    response = client.get(f"/projects/{other_project.id}/transactions", headers=auth_headers)
    assert response.status_code == 404

    response = client.post(
        f"/projects/{other_project.id}/transactions",
        json={"amount": "1.00", "date": "2026-01-01"},
        headers=auth_headers,
    )
    assert response.status_code == 404
```

Note: `test_suggest_categories_empty_when_no_transactions` is intentionally loose (`in (200, 404)`) because that endpoint is added in Task 7 — Task 7 tightens this assertion to `== 200` once the route exists. Remove the `in (200, 404)` version and replace with `assert response.json() == []` / `assert response.status_code == 200` in Task 7's step.

- [ ] **Step 7: Run to verify it passes**

Run: `cd backend && pytest -v`
Expected: all PASSED (the loose category-suggest assertion passes on 404 for now).

- [ ] **Step 8: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat(backend): add transaction CRUD with filters and amount quantization"
```

---

## Task 6: Project summary (charts data)

**Files:**
- Create: `backend/app/schemas/summary.py`
- Create: `backend/app/services/summary_service.py`
- Modify: `backend/app/api/routes/projects.py` (append route)
- Create: `backend/tests/test_summary.py`

**Interfaces:**
- Consumes: `Transaction` model (Task 5), `get_project_or_404` (Task 4).
- Produces: `ProjectSummary` schema (`balance`, `cumulative: list[BalancePoint]`, `flow: list[FlowPoint]`), `summary_service.get_project_summary(db, project_id) -> ProjectSummary`, `GET /projects/{project_id}/summary` — consumed by the frontend Task 13.

- [ ] **Step 1: Create `backend/app/schemas/summary.py`**

```python
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class BalancePoint(BaseModel):
    date: date
    balance: Decimal


class FlowPoint(BaseModel):
    period: str
    income: Decimal
    expense: Decimal


class ProjectSummary(BaseModel):
    balance: Decimal
    cumulative: list[BalancePoint]
    flow: list[FlowPoint]
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_summary.py`:

```python
from decimal import Decimal

from app.models.transaction import Transaction
from app.services.summary_service import get_project_summary


def test_summary_computes_cumulative_and_monthly_flow(db_session):
    from app.models.project import Project
    from app.models.user import User

    user = User(username="u", password_hash="x")
    db_session.add(user)
    db_session.commit()
    project = Project(owner_id=user.id, name="p")
    db_session.add(project)
    db_session.commit()

    db_session.add_all(
        [
            Transaction(project_id=project.id, amount=Decimal("100.00"), date="2026-01-05"),
            Transaction(project_id=project.id, amount=Decimal("-30.00"), date="2026-01-10"),
            Transaction(project_id=project.id, amount=Decimal("50.00"), date="2026-02-01"),
        ]
    )
    db_session.commit()

    summary = get_project_summary(db_session, project.id)

    assert summary.balance == Decimal("120.00")
    assert [p.balance for p in summary.cumulative] == [
        Decimal("100.00"),
        Decimal("70.00"),
        Decimal("120.00"),
    ]
    assert len(summary.flow) == 2
    jan = next(f for f in summary.flow if f.period == "2026-01")
    assert jan.income == Decimal("100.00")
    assert jan.expense == Decimal("30.00")


def test_summary_empty_project_has_zero_balance_and_no_points(db_session):
    from app.models.project import Project
    from app.models.user import User

    user = User(username="u2", password_hash="x")
    db_session.add(user)
    db_session.commit()
    project = Project(owner_id=user.id, name="empty")
    db_session.add(project)
    db_session.commit()

    summary = get_project_summary(db_session, project.id)

    assert summary.balance == Decimal("0")
    assert summary.cumulative == []
    assert summary.flow == []
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && pytest tests/test_summary.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.summary_service'`

- [ ] **Step 4: Create `backend/app/services/summary_service.py`**

```python
from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.summary import BalancePoint, FlowPoint, ProjectSummary

# ponytail: aggregation done in Python over the whole row set, not SQL GROUP
# BY. Fine for a personal-finance project's transaction volume; move to a
# SQL aggregate if a single project ever grows into the tens of thousands
# of transactions and this becomes measurably slow.


def get_project_summary(db: Session, project_id: int) -> ProjectSummary:
    transactions = (
        db.query(Transaction)
        .filter(Transaction.project_id == project_id)
        .order_by(Transaction.date, Transaction.id)
        .all()
    )

    cumulative: list[BalancePoint] = []
    running = Decimal("0")
    for tx in transactions:
        running += tx.amount
        cumulative.append(BalancePoint(date=tx.date, balance=running))

    flow_totals: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"income": Decimal("0"), "expense": Decimal("0")}
    )
    for tx in transactions:
        period = tx.date.strftime("%Y-%m")
        if tx.amount >= 0:
            flow_totals[period]["income"] += tx.amount
        else:
            flow_totals[period]["expense"] += -tx.amount

    flow = [
        FlowPoint(period=period, income=totals["income"], expense=totals["expense"])
        for period, totals in sorted(flow_totals.items())
    ]

    return ProjectSummary(balance=running, cumulative=cumulative, flow=flow)
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && pytest tests/test_summary.py -v`
Expected: 2 PASSED

- [ ] **Step 6: Append the route to `backend/app/api/routes/projects.py`**

Add the import `from app.schemas.summary import ProjectSummary` and `from app.services import summary_service` (alongside the existing `project_service` import), then append at the end of the file:

```python
@router.get("/{project_id}/summary", response_model=ProjectSummary)
def get_project_summary(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectSummary:
    project_service.get_project_or_404(db, current_user.id, project_id)
    return summary_service.get_project_summary(db, project_id)
```

- [ ] **Step 7: Write the API-level test**

Add to `backend/tests/test_summary.py`:

```python
def test_summary_endpoint(client, auth_headers):
    create = client.post("/projects", json={"name": "p"}, headers=auth_headers)
    project_id = create.json()["id"]
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "10.00", "date": "2026-01-01"},
        headers=auth_headers,
    )

    response = client.get(f"/projects/{project_id}/summary", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["balance"] == "10.00"
    assert len(body["cumulative"]) == 1
```

- [ ] **Step 8: Run the full suite**

Run: `cd backend && pytest -v`
Expected: all PASSED.

- [ ] **Step 9: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat(backend): add project summary endpoint for chart data"
```

---

## Task 7: Category autocomplete endpoint

**Files:**
- Modify: `backend/app/api/routes/projects.py` (append route)
- Modify: `backend/tests/test_transactions.py` (tighten the loose assertion from Task 5)

**Interfaces:**
- Consumes: `transaction_service.suggest_categories` (Task 5).
- Produces: `GET /projects/{project_id}/categories/suggest -> list[str]`.

- [ ] **Step 1: Append the route to `backend/app/api/routes/projects.py`**

Add `from app.services import transaction_service` to the existing services import line, then append:

```python
@router.get("/{project_id}/categories/suggest", response_model=list[str])
def suggest_categories(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    project_service.get_project_or_404(db, current_user.id, project_id)
    return transaction_service.suggest_categories(db, project_id)
```

- [ ] **Step 2: Tighten the Task-5 test in `backend/tests/test_transactions.py`**

Replace:

```python
def test_suggest_categories_empty_when_no_transactions(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    response = client.get(f"/projects/{project_id}/categories/suggest", headers=auth_headers)
    # Route doesn't exist yet (added in Task 7) — this test is added here as a
    # placeholder reminder and is skipped until Task 7 registers the route.
    assert response.status_code in (200, 404)
```

with:

```python
def test_suggest_categories_empty_when_no_transactions(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    response = client.get(f"/projects/{project_id}/categories/suggest", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_suggest_categories_returns_distinct_used_categories(client, auth_headers):
    project_id = _create_project(client, auth_headers)
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "10.00", "date": "2026-01-01", "category": "cibo"},
        headers=auth_headers,
    )
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "20.00", "date": "2026-01-02", "category": "cibo"},
        headers=auth_headers,
    )
    client.post(
        f"/projects/{project_id}/transactions",
        json={"amount": "30.00", "date": "2026-01-03", "category": "affitto"},
        headers=auth_headers,
    )

    response = client.get(f"/projects/{project_id}/categories/suggest", headers=auth_headers)
    assert response.status_code == 200
    assert sorted(response.json()) == ["affitto", "cibo"]
```

- [ ] **Step 3: Run the full suite**

Run: `cd backend && pytest -v`
Expected: all PASSED.

- [ ] **Step 4: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat(backend): add category autocomplete endpoint"
```

---

## Task 8: Dashboard recent transactions

**Files:**
- Create: `backend/app/schemas/dashboard.py`
- Create: `backend/app/services/dashboard_service.py`
- Create: `backend/app/api/routes/dashboard.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_dashboard.py`

**Interfaces:**
- Consumes: `Transaction`, `Project` models (Tasks 4, 5).
- Produces: `RecentTransactionRead` schema, `dashboard_service.get_recent_transactions(db, owner_id, limit) -> list[RecentTransactionRead]`, `GET /dashboard/recent`.

- [ ] **Step 1: Create `backend/app/schemas/dashboard.py`**

```python
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class RecentTransactionRead(BaseModel):
    id: int
    project_id: int
    project_name: str
    amount: Decimal
    date: date
    note: str | None
    category: str | None
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_dashboard.py`:

```python
def test_recent_transactions_aggregates_across_projects(client, auth_headers):
    p1 = client.post("/projects", json={"name": "Progetto 1"}, headers=auth_headers).json()["id"]
    p2 = client.post("/projects", json={"name": "Progetto 2"}, headers=auth_headers).json()["id"]

    client.post(
        f"/projects/{p1}/transactions",
        json={"amount": "10.00", "date": "2026-01-01", "note": "a"},
        headers=auth_headers,
    )
    client.post(
        f"/projects/{p2}/transactions",
        json={"amount": "20.00", "date": "2026-01-02", "note": "b"},
        headers=auth_headers,
    )

    response = client.get("/dashboard/recent", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    # most recent date first
    assert body[0]["note"] == "b"
    assert body[0]["project_name"] == "Progetto 2"


def test_recent_transactions_respects_limit(client, auth_headers):
    project_id = client.post("/projects", json={"name": "p"}, headers=auth_headers).json()["id"]
    for day in range(1, 6):
        client.post(
            f"/projects/{project_id}/transactions",
            json={"amount": "1.00", "date": f"2026-01-0{day}"},
            headers=auth_headers,
        )

    response = client.get("/dashboard/recent", params={"limit": 3}, headers=auth_headers)
    assert len(response.json()) == 3


def test_recent_transactions_empty_when_no_projects(client, auth_headers):
    response = client.get("/dashboard/recent", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && pytest tests/test_dashboard.py -v`
Expected: FAIL with 404 (route not registered yet).

- [ ] **Step 4: Create `backend/app/services/dashboard_service.py`**

```python
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.transaction import Transaction
from app.schemas.dashboard import RecentTransactionRead


def get_recent_transactions(db: Session, owner_id: int, limit: int = 10) -> list[RecentTransactionRead]:
    rows = (
        db.query(Transaction, Project.name)
        .join(Project, Transaction.project_id == Project.id)
        .filter(Project.owner_id == owner_id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(limit)
        .all()
    )
    return [
        RecentTransactionRead(
            id=tx.id,
            project_id=tx.project_id,
            project_name=name,
            amount=tx.amount,
            date=tx.date,
            note=tx.note,
            category=tx.category,
        )
        for tx, name in rows
    ]
```

- [ ] **Step 5: Create `backend/app/api/routes/dashboard.py`**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.dashboard import RecentTransactionRead
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/recent", response_model=list[RecentTransactionRead])
def get_recent(
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RecentTransactionRead]:
    return dashboard_service.get_recent_transactions(db, current_user.id, limit)
```

- [ ] **Step 6: Register the router in `backend/app/main.py`**

Add `dashboard` to the routes import and `app.include_router(dashboard.router)`. `main.py`'s routes import line should now read:

```python
from app.api.routes import auth, dashboard, health, projects, transactions
```

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && pytest -v`
Expected: all PASSED. This closes out the backend — verify with `uvicorn app.main:app --reload --port 8000` and `curl http://localhost:8000/health` manually if you want a sanity check outside pytest.

- [ ] **Step 8: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat(backend): add cross-project recent transactions endpoint"
```

---

## Task 9: Frontend scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/App.test.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/vitest.setup.ts`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/services/api.ts`
- Create: `frontend/src/services/api.test.ts`

**Interfaces:**
- Produces: typed `api.ts` client (`login`, `getToken`/`setToken`/`clearToken`, `ApiError`, and the rest of the CRUD functions used by every later frontend task), `types.ts` interfaces (`Project`, `Transaction`, `RecentTransaction`, `BalancePoint`, `FlowPoint`, `ProjectSummary` — **all money fields are `string`**, see Global Constraints), `App` router shell.

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "finance-tracker-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4",
    "vite": "^5.4.3",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `frontend/vite.config.ts`**

```typescript
/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/vitest.setup.ts",
    globals: true,
  },
});
```

- [ ] **Step 3: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `frontend/tailwind.config.js` and `frontend/postcss.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 6: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Finance Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Create `frontend/src/vitest.setup.ts`**

Recharts' `ResponsiveContainer` (used from Task 13 onward) needs `ResizeObserver`, which jsdom doesn't provide — polyfilled once here so every later chart test just works.

```typescript
import "@testing-library/jest-dom/vitest";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
```

- [ ] **Step 9: Create `frontend/src/types.ts`**

```typescript
export interface Project {
  id: number;
  name: string;
  balance: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  project_id: number;
  amount: string;
  date: string;
  note: string | null;
  category: string | null;
  created_at: string;
}

export interface RecentTransaction {
  id: number;
  project_id: number;
  project_name: string;
  amount: string;
  date: string;
  note: string | null;
  category: string | null;
}

export interface BalancePoint {
  date: string;
  balance: string;
}

export interface FlowPoint {
  period: string;
  income: string;
  expense: string;
}

export interface ProjectSummary {
  balance: string;
  cumulative: BalancePoint[];
  flow: FlowPoint[];
}
```

- [ ] **Step 10: Create `frontend/src/services/api.ts`**

```typescript
import type {
  Project,
  ProjectSummary,
  RecentTransaction,
  Transaction,
} from "../types";

const TOKEN_KEY = "finance_tracker_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`/api${path}`, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, body.detail ?? "Errore sconosciuto");
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<string> {
  const data = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return data.access_token;
}

export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return request<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
}

export function getProjects(): Promise<Project[]> {
  return request<Project[]>("/projects");
}

export function getProject(id: number): Promise<Project> {
  return request<Project>(`/projects/${id}`);
}

export function createProject(name: string): Promise<Project> {
  return request<Project>("/projects", { method: "POST", body: JSON.stringify({ name }) });
}

export function updateProject(id: number, name: string): Promise<Project> {
  return request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export function deleteProject(id: number): Promise<void> {
  return request<void>(`/projects/${id}`, { method: "DELETE" });
}

export function getProjectSummary(id: number): Promise<ProjectSummary> {
  return request<ProjectSummary>(`/projects/${id}/summary`);
}

export function suggestCategories(projectId: number): Promise<string[]> {
  return request<string[]>(`/projects/${projectId}/categories/suggest`);
}

export interface TransactionFilters {
  fromDate?: string;
  toDate?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export function getTransactions(
  projectId: number,
  filters: TransactionFilters = {},
): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (filters.fromDate) params.set("from_date", filters.fromDate);
  if (filters.toDate) params.set("to_date", filters.toDate);
  if (filters.category) params.set("category", filters.category);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  const query = params.toString();
  return request<Transaction[]>(`/projects/${projectId}/transactions${query ? `?${query}` : ""}`);
}

export interface TransactionInput {
  amount: number;
  date: string;
  note: string | null;
  category: string | null;
}

export function createTransaction(projectId: number, data: TransactionInput): Promise<Transaction> {
  return request<Transaction>(`/projects/${projectId}/transactions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTransaction(
  projectId: number,
  txId: number,
  data: Partial<TransactionInput>,
): Promise<Transaction> {
  return request<Transaction>(`/projects/${projectId}/transactions/${txId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteTransaction(projectId: number, txId: number): Promise<void> {
  return request<void>(`/projects/${projectId}/transactions/${txId}`, { method: "DELETE" });
}

export function getRecentTransactions(limit = 10): Promise<RecentTransaction[]> {
  return request<RecentTransaction[]>(`/dashboard/recent?limit=${limit}`);
}
```

- [ ] **Step 11: Write the failing test for the API client**

Create `frontend/src/services/api.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, clearToken, getToken, login, setToken } from "./api";

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores and retrieves the token", () => {
    expect(getToken()).toBeNull();
    setToken("abc123");
    expect(getToken()).toBe("abc123");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("returns the access token on successful login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "tok" }), { status: 200 })),
    );

    const token = await login("admin", "admin");
    expect(token).toBe("tok");
  });

  it("throws ApiError with the backend detail message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: "Credenziali non valide" }), { status: 401 }),
        ),
    );

    await expect(login("admin", "wrong")).rejects.toThrow(ApiError);
  });
});
```

- [ ] **Step 12: Create `frontend/src/App.tsx`**

```typescript
import { BrowserRouter, Route, Routes } from "react-router-dom";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Finance Tracker</div>} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 13: Create `frontend/src/App.test.tsx`**

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the placeholder home route", () => {
    render(<App />);
    expect(screen.getByText("Finance Tracker")).toBeInTheDocument();
  });
});
```

- [ ] **Step 14: Create `frontend/src/main.tsx`**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 15: Install and run**

```bash
cd frontend
npm install
npm run test
npm run build
```

Expected: all Vitest tests PASS, `tsc -b && vite build` succeeds with no type errors.

- [ ] **Step 16: Commit**

```bash
git add frontend
git commit -m "feat(frontend): scaffold Vite/React/TS/Tailwind app with typed api client"
```

---

## Task 10: Auth frontend

**Files:**
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/LoginPage.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `login`, `getToken`, `setToken`, `clearToken` (Task 9).
- Produces: `useAuth() -> { isAuthenticated, login, logout }`, `<ProtectedRoute>` (used by Task 11+ routes), `LoginPage`.

- [ ] **Step 1: Create `frontend/src/hooks/useAuth.ts`**

```typescript
import { useCallback, useState } from "react";
import { clearToken, getToken, login as apiLogin, setToken } from "../services/api";

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(getToken());

  const login = useCallback(async (username: string, password: string) => {
    const newToken = await apiLogin(username, password);
    setToken(newToken);
    setTokenState(newToken);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  return { isAuthenticated: token !== null, login, logout };
}
```

- [ ] **Step 2: Create `frontend/src/components/ProtectedRoute.tsx`**

```typescript
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getToken } from "../services/api";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 3: Write the failing test for `LoginPage`**

Create `frontend/src/pages/LoginPage.test.tsx`:

```typescript
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("logs in with the entered credentials on submit", async () => {
    vi.spyOn(api, "login").mockResolvedValue("tok123");

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Utente"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));

    await waitFor(() => expect(api.login).toHaveBeenCalledWith("admin", "admin"));
  });

  it("shows an error message on failed login", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("nope"));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Utente"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));

    await waitFor(() => expect(screen.getByText("Credenziali non valide")).toBeInTheDocument());
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd frontend && npx vitest run src/pages/LoginPage.test.tsx`
Expected: FAIL (module `./LoginPage` doesn't exist).

- [ ] **Step 5: Create `frontend/src/pages/LoginPage.tsx`**

```typescript
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Credenziali non valide");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="w-80 rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-xl font-semibold">Accedi</h1>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <label className="mb-2 block text-sm">
          Utente
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="mb-4 block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded border px-2 py-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="w-full rounded bg-slate-800 py-2 text-white">
          Accedi
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd frontend && npx vitest run src/pages/LoginPage.test.tsx`
Expected: 2 PASSED

- [ ] **Step 7: Wire routing in `frontend/src/App.tsx`**

```typescript
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Dashboard (in arrivo)</div>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 8: Update `frontend/src/App.test.tsx`**

Replace its content (the old placeholder-text assertion no longer holds since `/` now redirects unauthenticated visitors):

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("redirects an unauthenticated visitor to the login page", () => {
    localStorage.clear();
    render(<App />);
    expect(screen.getByLabelText("Utente")).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: Run the full frontend suite**

Run: `cd frontend && npm run test`
Expected: all PASSED.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add login page, useAuth hook, and protected routing"
```

---

## Task 11: Dashboard page (projects grid + CRUD)

**Files:**
- Create: `frontend/src/hooks/useProjects.ts`
- Create: `frontend/src/components/ProjectCard.tsx`
- Create: `frontend/src/components/ProjectFormModal.tsx`
- Create: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/pages/DashboardPage.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `getProjects`, `createProject`, `updateProject`, `deleteProject` (Task 9).
- Produces: `useProjects()`, `<ProjectCard>`, `<ProjectFormModal>`, `<DashboardPage>` mounted at `/`.

- [ ] **Step 1: Create `frontend/src/hooks/useProjects.ts`**

```typescript
import { useCallback, useEffect, useState } from "react";
import * as api from "../services/api";
import type { Project } from "../types";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await api.getProjects());
      setError(null);
    } catch {
      setError("Impossibile caricare i progetti");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProject = useCallback(
    async (name: string) => {
      await api.createProject(name);
      await refresh();
    },
    [refresh],
  );

  const renameProject = useCallback(
    async (id: number, name: string) => {
      await api.updateProject(id, name);
      await refresh();
    },
    [refresh],
  );

  const removeProject = useCallback(
    async (id: number) => {
      await api.deleteProject(id);
      await refresh();
    },
    [refresh],
  );

  return { projects, loading, error, createProject, renameProject, removeProject };
}
```

- [ ] **Step 2: Create `frontend/src/components/ProjectCard.tsx`**

```typescript
import { Link } from "react-router-dom";
import type { Project } from "../types";

interface Props {
  project: Project;
  onRename: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, onRename, onDelete }: Props) {
  const balance = Number(project.balance);
  const balanceColor = balance >= 0 ? "text-emerald-600" : "text-red-600";

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <Link to={`/projects/${project.id}`} className="text-lg font-semibold hover:underline">
        {project.name}
      </Link>
      <p className={`mt-2 text-2xl font-bold ${balanceColor}`}>{balance.toFixed(2)} €</p>
      <div className="mt-3 flex gap-2 text-sm">
        <button onClick={onRename} className="text-slate-500 hover:underline">
          Rinomina
        </button>
        <button onClick={onDelete} className="text-red-500 hover:underline">
          Elimina
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/ProjectFormModal.tsx`**

```typescript
import { useState, type FormEvent } from "react";

interface Props {
  title: string;
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

export function ProjectFormModal({ title, initialName = "", onSubmit, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(name);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="w-80 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        <label className="mb-4 block text-sm">
          Nome progetto
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1 text-slate-600">
            Annulla
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50"
          >
            Salva
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Write the failing test for `DashboardPage`**

Create `frontend/src/pages/DashboardPage.test.tsx`:

```typescript
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import type { Project } from "../types";
import { DashboardPage } from "./DashboardPage";

const projects: Project[] = [
  { id: 1, name: "Portafoglio personale", balance: "150.00", created_at: "2026-01-01T00:00:00" },
];

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.spyOn(api, "getProjects").mockResolvedValue(projects);
  });

  it("lists existing projects with their balance", async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Portafoglio personale")).toBeInTheDocument();
    expect(screen.getByText("150.00 €")).toBeInTheDocument();
  });

  it("creates a new project through the modal", async () => {
    vi.spyOn(api, "createProject").mockResolvedValue({
      id: 2,
      name: "Stignano",
      balance: "0",
      created_at: "2026-01-02T00:00:00",
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Nuovo progetto"));
    fireEvent.change(screen.getByLabelText("Nome progetto"), { target: { value: "Stignano" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith("Stignano"));
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `cd frontend && npx vitest run src/pages/DashboardPage.test.tsx`
Expected: FAIL (module doesn't exist).

- [ ] **Step 6: Create `frontend/src/pages/DashboardPage.tsx`**

```typescript
import { useState } from "react";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { useProjects } from "../hooks/useProjects";
import type { Project } from "../types";

export function DashboardPage() {
  const { projects, loading, error, createProject, renameProject, removeProject } = useProjects();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Project | null>(null);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Progetti</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded bg-slate-800 px-3 py-2 text-sm text-white"
        >
          Nuovo progetto
        </button>
      </div>

      {loading && <p>Caricamento...</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onRename={() => setRenaming(project)}
            onDelete={() => removeProject(project.id)}
          />
        ))}
      </div>

      {creating && (
        <ProjectFormModal
          title="Nuovo progetto"
          onSubmit={createProject}
          onClose={() => setCreating(false)}
        />
      )}
      {renaming && (
        <ProjectFormModal
          title="Rinomina progetto"
          initialName={renaming.name}
          onSubmit={(name) => renameProject(renaming.id, name)}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `cd frontend && npx vitest run src/pages/DashboardPage.test.tsx`
Expected: 2 PASSED

- [ ] **Step 8: Wire `DashboardPage` into `frontend/src/App.tsx`**

Replace the `<div>Dashboard (in arrivo)</div>` placeholder on the `/` route with `<DashboardPage />` (add the import).

- [ ] **Step 9: Run the full frontend suite**

Run: `cd frontend && npm run test`
Expected: all PASSED.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add dashboard page with project grid and CRUD modals"
```

---

## Task 12: Recent transactions on dashboard

**Files:**
- Create: `frontend/src/hooks/useRecentTransactions.ts`
- Create: `frontend/src/components/RecentTransactionsList.tsx`
- Create: `frontend/src/components/RecentTransactionsList.test.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `getRecentTransactions` (Task 9).
- Produces: `useRecentTransactions(limit)`, `<RecentTransactionsList>` rendered on the dashboard.

- [ ] **Step 1: Create `frontend/src/hooks/useRecentTransactions.ts`**

```typescript
import { useEffect, useState } from "react";
import * as api from "../services/api";
import type { RecentTransaction } from "../types";

export function useRecentTransactions(limit = 10) {
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getRecentTransactions(limit)
      .then(setTransactions)
      .finally(() => setLoading(false));
  }, [limit]);

  return { transactions, loading };
}
```

- [ ] **Step 2: Write the failing test for `RecentTransactionsList`**

Create `frontend/src/components/RecentTransactionsList.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { RecentTransaction } from "../types";
import { RecentTransactionsList } from "./RecentTransactionsList";

describe("RecentTransactionsList", () => {
  it("shows an empty-state message when there are no transactions", () => {
    render(
      <MemoryRouter>
        <RecentTransactionsList transactions={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Nessuna transazione registrata.")).toBeInTheDocument();
  });

  it("renders each transaction with its project name and formatted amount", () => {
    const transactions: RecentTransaction[] = [
      {
        id: 1,
        project_id: 5,
        project_name: "Stignano",
        amount: "-42.50",
        date: "2026-01-15",
        note: "Bolletta luce",
        category: "utenze",
      },
    ];

    render(
      <MemoryRouter>
        <RecentTransactionsList transactions={transactions} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Stignano")).toBeInTheDocument();
    expect(screen.getByText("Bolletta luce")).toBeInTheDocument();
    expect(screen.getByText("-42.50 €")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/RecentTransactionsList.test.tsx`
Expected: FAIL (module doesn't exist).

- [ ] **Step 4: Create `frontend/src/components/RecentTransactionsList.tsx`**

```typescript
import { Link } from "react-router-dom";
import type { RecentTransaction } from "../types";

export function RecentTransactionsList({ transactions }: { transactions: RecentTransaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-slate-500">Nessuna transazione registrata.</p>;
  }

  return (
    <ul className="divide-y rounded-lg border bg-white">
      {transactions.map((tx) => {
        const amount = Number(tx.amount);
        return (
          <li key={tx.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <div>
              <Link to={`/projects/${tx.project_id}`} className="font-medium hover:underline">
                {tx.project_name}
              </Link>
              <p className="text-slate-500">{tx.note ?? tx.category ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className={amount >= 0 ? "text-emerald-600" : "text-red-600"}>
                {amount.toFixed(2)} €
              </p>
              <p className="text-slate-400">{tx.date}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd frontend && npx vitest run src/components/RecentTransactionsList.test.tsx`
Expected: 2 PASSED

- [ ] **Step 6: Wire into `frontend/src/pages/DashboardPage.tsx`**

Add the imports `import { RecentTransactionsList } from "../components/RecentTransactionsList";` and `import { useRecentTransactions } from "../hooks/useRecentTransactions";`, then inside the component add `const { transactions } = useRecentTransactions();` and append below the projects grid `<div>`:

```typescript
<h2 className="mb-2 mt-8 text-xl font-semibold">Ultime transazioni</h2>
<RecentTransactionsList transactions={transactions} />
```

- [ ] **Step 7: Run the full frontend suite**

Run: `cd frontend && npm run test`
Expected: all PASSED.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): show recent cross-project transactions on the dashboard"
```

---

## Task 13: Project detail page shell + charts

**Files:**
- Create: `frontend/src/hooks/useProjectSummary.ts`
- Create: `frontend/src/components/BalanceChart.tsx`
- Create: `frontend/src/components/FlowChart.tsx`
- Create: `frontend/src/pages/ProjectDetailPage.tsx`
- Create: `frontend/src/pages/ProjectDetailPage.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `getProjectSummary` (Task 9).
- Produces: `useProjectSummary(projectId)`, `<BalanceChart>`, `<FlowChart>`, `<ProjectDetailPage>` mounted at `/projects/:projectId` — Task 14 extends this page with the transaction list and form.

- [ ] **Step 1: Create `frontend/src/hooks/useProjectSummary.ts`**

```typescript
import { useEffect, useState } from "react";
import * as api from "../services/api";
import type { ProjectSummary } from "../types";

export function useProjectSummary(projectId: number) {
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getProjectSummary(projectId)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [projectId]);

  return { summary, loading };
}
```

- [ ] **Step 2: Create `frontend/src/components/BalanceChart.tsx`**

```typescript
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BalancePoint } from "../types";

export function BalanceChart({ data }: { data: BalancePoint[] }) {
  if (data.length === 0) {
    return <p className="text-slate-500">Nessun dato ancora da mostrare.</p>;
  }

  const chartData = data.map((point) => ({ date: point.date, balance: Number(point.balance) }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="balance" stroke="#1e293b" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/FlowChart.tsx`**

```typescript
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FlowPoint } from "../types";

export function FlowChart({ data }: { data: FlowPoint[] }) {
  if (data.length === 0) {
    return <p className="text-slate-500">Nessun dato ancora da mostrare.</p>;
  }

  const chartData = data.map((point) => ({
    period: point.period,
    income: Number(point.income),
    expense: Number(point.expense),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="income" fill="#059669" name="Entrate" />
        <Bar dataKey="expense" fill="#dc2626" name="Uscite" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Write the failing test for `ProjectDetailPage`**

Create `frontend/src/pages/ProjectDetailPage.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import type { ProjectSummary } from "../types";
import { ProjectDetailPage } from "./ProjectDetailPage";

const summary: ProjectSummary = {
  balance: "120.50",
  cumulative: [{ date: "2026-01-01", balance: "120.50" }],
  flow: [{ period: "2026-01", income: "200.00", expense: "79.50" }],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    vi.spyOn(api, "getProjectSummary").mockResolvedValue(summary);
  });

  it("shows the current balance", async () => {
    renderPage();
    expect(await screen.findByText("120.50 €")).toBeInTheDocument();
  });

  it("shows an empty-state message when there is no chart data yet", async () => {
    vi.spyOn(api, "getProjectSummary").mockResolvedValue({ balance: "0", cumulative: [], flow: [] });
    renderPage();
    const messages = await screen.findAllByText("Nessun dato ancora da mostrare.");
    expect(messages).toHaveLength(2);
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `cd frontend && npx vitest run src/pages/ProjectDetailPage.test.tsx`
Expected: FAIL (module doesn't exist).

- [ ] **Step 6: Create `frontend/src/pages/ProjectDetailPage.tsx`**

```typescript
import { useParams } from "react-router-dom";
import { BalanceChart } from "../components/BalanceChart";
import { FlowChart } from "../components/FlowChart";
import { useProjectSummary } from "../hooks/useProjectSummary";

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);
  const { summary, loading } = useProjectSummary(id);

  if (loading || !summary) {
    return <p className="p-6">Caricamento...</p>;
  }

  const balance = Number(summary.balance);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className={`text-3xl font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
        {balance.toFixed(2)} €
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Andamento saldo</h2>
          <BalanceChart data={summary.cumulative} />
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Entrate/uscite per mese</h2>
          <FlowChart data={summary.flow} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `cd frontend && npx vitest run src/pages/ProjectDetailPage.test.tsx`
Expected: 2 PASSED

- [ ] **Step 8: Add the route in `frontend/src/App.tsx`**

Add the import `import { ProjectDetailPage } from "./pages/ProjectDetailPage";` and a new `<Route>` before the catch-all:

```typescript
<Route
  path="/projects/:projectId"
  element={
    <ProtectedRoute>
      <ProjectDetailPage />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 9: Run the full frontend suite**

Run: `cd frontend && npm run test`
Expected: all PASSED.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add project detail page with balance and trend charts"
```

---

## Task 14: Transaction list, filters, create/edit/delete

**Files:**
- Create: `frontend/src/hooks/useTransactions.ts`
- Create: `frontend/src/hooks/useCategorySuggestions.ts`
- Create: `frontend/src/components/TransactionList.tsx`
- Create: `frontend/src/components/TransactionFormModal.tsx`
- Modify: `frontend/src/pages/ProjectDetailPage.tsx`
- Modify: `frontend/src/pages/ProjectDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getTransactions`, `createTransaction`, `updateTransaction`, `deleteTransaction`, `suggestCategories`, `TransactionFilters`, `TransactionInput` (Task 9).
- Produces: full transaction CRUD UI wired into `ProjectDetailPage`.

- [ ] **Step 1: Create `frontend/src/hooks/useTransactions.ts`**

```typescript
import { useCallback, useEffect, useState } from "react";
import * as api from "../services/api";
import type { TransactionFilters } from "../services/api";
import type { Transaction } from "../types";

export function useTransactions(projectId: number, filters: TransactionFilters) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    return api
      .getTransactions(projectId, filters)
      .then(setTransactions)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filters.fromDate, filters.toDate, filters.category, filters.limit, filters.offset]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transactions, loading, refresh };
}
```

- [ ] **Step 2: Create `frontend/src/hooks/useCategorySuggestions.ts`**

```typescript
import { useEffect, useState } from "react";
import * as api from "../services/api";

export function useCategorySuggestions(projectId: number) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    api.suggestCategories(projectId).then(setSuggestions);
  }, [projectId]);

  return suggestions;
}
```

- [ ] **Step 3: Create `frontend/src/components/TransactionList.tsx`**

```typescript
import type { Transaction } from "../types";

interface Props {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function TransactionList({ transactions, onEdit, onDelete }: Props) {
  if (transactions.length === 0) {
    return <p className="text-slate-500">Nessuna transazione in questo periodo.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-slate-500">
          <th className="py-2">Data</th>
          <th>Nota</th>
          <th>Categoria</th>
          <th className="text-right">Importo</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => {
          const amount = Number(tx.amount);
          return (
            <tr key={tx.id} className="border-b">
              <td className="py-2">{tx.date}</td>
              <td>{tx.note ?? "—"}</td>
              <td>{tx.category ?? "—"}</td>
              <td className={`text-right ${amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {amount.toFixed(2)} €
              </td>
              <td className="text-right">
                <button onClick={() => onEdit(tx)} className="mr-2 text-slate-500 hover:underline">
                  Modifica
                </button>
                <button onClick={() => onDelete(tx)} className="text-red-500 hover:underline">
                  Elimina
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/TransactionFormModal.tsx`**

The sign toggle is the trickiest bit of logic in the whole frontend: the user picks "Entrata"/"Uscita" and types a positive magnitude, and the component computes the signed `amount` sent to the API.

```typescript
import { useState, type FormEvent } from "react";
import type { TransactionInput } from "../services/api";
import type { Transaction } from "../types";

interface Props {
  categorySuggestions: string[];
  initial?: Transaction;
  onSubmit: (data: TransactionInput) => Promise<void>;
  onClose: () => void;
}

export function TransactionFormModal({ categorySuggestions, initial, onSubmit, onClose }: Props) {
  const [isIncome, setIsIncome] = useState(initial ? Number(initial.amount) >= 0 : true);
  const [magnitude, setMagnitude] = useState(
    initial ? Math.abs(Number(initial.amount)).toString() : "",
  );
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(initial?.note ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const value = Number(magnitude);
      await onSubmit({
        amount: isIncome ? value : -value,
        date,
        note: note || null,
        category: category || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="w-96 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">
          {initial ? "Modifica transazione" : "Nuova transazione"}
        </h2>

        <div className="mb-3 flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setIsIncome(true)}
            className={`flex-1 rounded border py-1 ${isIncome ? "bg-emerald-600 text-white" : ""}`}
          >
            Entrata
          </button>
          <button
            type="button"
            onClick={() => setIsIncome(false)}
            className={`flex-1 rounded border py-1 ${!isIncome ? "bg-red-600 text-white" : ""}`}
          >
            Uscita
          </button>
        </div>

        <label className="mb-3 block text-sm">
          Importo
          <input
            type="number"
            step="0.01"
            min="0"
            className="mt-1 w-full rounded border px-2 py-1"
            value={magnitude}
            onChange={(e) => setMagnitude(e.target.value)}
            required
          />
        </label>

        <label className="mb-3 block text-sm">
          Data
          <input
            type="date"
            className="mt-1 w-full rounded border px-2 py-1"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>

        <label className="mb-3 block text-sm">
          Nota
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <label className="mb-4 block text-sm">
          Categoria
          <input
            list="category-suggestions"
            className="mt-1 w-full rounded border px-2 py-1"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="category-suggestions">
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1 text-slate-600">
            Annulla
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50"
          >
            Salva
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Update `frontend/src/pages/ProjectDetailPage.test.tsx`**

Add transaction-related mocks and tests. Replace the file content with:

```typescript
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import type { ProjectSummary, Transaction } from "../types";
import { ProjectDetailPage } from "./ProjectDetailPage";

const summary: ProjectSummary = {
  balance: "120.50",
  cumulative: [{ date: "2026-01-01", balance: "120.50" }],
  flow: [{ period: "2026-01", income: "200.00", expense: "79.50" }],
};

const transactions: Transaction[] = [
  {
    id: 1,
    project_id: 1,
    amount: "120.50",
    date: "2026-01-01",
    note: "Stipendio",
    category: "reddito",
    created_at: "2026-01-01T00:00:00",
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    vi.spyOn(api, "getProjectSummary").mockResolvedValue(summary);
    vi.spyOn(api, "getTransactions").mockResolvedValue(transactions);
    vi.spyOn(api, "suggestCategories").mockResolvedValue(["reddito", "affitto"]);
  });

  it("shows the current balance and the transaction list", async () => {
    renderPage();
    expect(await screen.findByText("120.50 €")).toBeInTheDocument();
    expect(await screen.findByText("Stipendio")).toBeInTheDocument();
  });

  it("shows an empty-state message when there is no chart data yet", async () => {
    vi.spyOn(api, "getProjectSummary").mockResolvedValue({ balance: "0", cumulative: [], flow: [] });
    vi.spyOn(api, "getTransactions").mockResolvedValue([]);
    renderPage();
    const chartMessages = await screen.findAllByText("Nessun dato ancora da mostrare.");
    expect(chartMessages).toHaveLength(2);
    expect(await screen.findByText("Nessuna transazione in questo periodo.")).toBeInTheDocument();
  });

  it("submits a negative amount when 'Uscita' is selected", async () => {
    vi.spyOn(api, "createTransaction").mockResolvedValue(transactions[0]);
    renderPage();

    fireEvent.click(await screen.findByText("Nuova transazione"));
    fireEvent.click(screen.getByText("Uscita"));
    fireEvent.change(screen.getByLabelText("Importo"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-02-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() =>
      expect(api.createTransaction).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ amount: -50, date: "2026-02-01" }),
      ),
    );
  });

  it("deletes a transaction", async () => {
    vi.spyOn(api, "deleteTransaction").mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByText("Elimina"));

    await waitFor(() => expect(api.deleteTransaction).toHaveBeenCalledWith(1, 1));
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd frontend && npx vitest run src/pages/ProjectDetailPage.test.tsx`
Expected: FAIL (page doesn't render transactions/form yet).

- [ ] **Step 7: Replace `frontend/src/pages/ProjectDetailPage.tsx`**

```typescript
import { useState } from "react";
import { useParams } from "react-router-dom";
import { BalanceChart } from "../components/BalanceChart";
import { FlowChart } from "../components/FlowChart";
import { TransactionFormModal } from "../components/TransactionFormModal";
import { TransactionList } from "../components/TransactionList";
import { useCategorySuggestions } from "../hooks/useCategorySuggestions";
import { useProjectSummary } from "../hooks/useProjectSummary";
import { useTransactions } from "../hooks/useTransactions";
import * as api from "../services/api";
import type { Transaction } from "../types";

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);

  const { summary, loading: summaryLoading } = useProjectSummary(id);
  const [filters, setFilters] = useState<{ fromDate?: string; toDate?: string; category?: string }>({});
  const { transactions, refresh } = useTransactions(id, filters);
  const categorySuggestions = useCategorySuggestions(id);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  async function handleDelete(tx: Transaction) {
    await api.deleteTransaction(id, tx.id);
    await refresh();
  }

  if (summaryLoading || !summary) {
    return <p className="p-6">Caricamento...</p>;
  }

  const balance = Number(summary.balance);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <p className={`text-3xl font-bold ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {balance.toFixed(2)} €
        </p>
        <button
          onClick={() => setCreating(true)}
          className="rounded bg-slate-800 px-3 py-2 text-sm text-white"
        >
          Nuova transazione
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Andamento saldo</h2>
          <BalanceChart data={summary.cumulative} />
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Entrate/uscite per mese</h2>
          <FlowChart data={summary.flow} />
        </div>
      </div>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Transazioni</h2>
      <div className="mb-3 flex gap-2 text-sm">
        <input
          type="date"
          value={filters.fromDate ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value || undefined }))}
          className="rounded border px-2 py-1"
        />
        <input
          type="date"
          value={filters.toDate ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value || undefined }))}
          className="rounded border px-2 py-1"
        />
        <input
          placeholder="Categoria"
          value={filters.category ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}
          className="rounded border px-2 py-1"
        />
      </div>

      <TransactionList transactions={transactions} onEdit={setEditing} onDelete={handleDelete} />

      {creating && (
        <TransactionFormModal
          categorySuggestions={categorySuggestions}
          onSubmit={async (data) => {
            await api.createTransaction(id, data);
            await refresh();
          }}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <TransactionFormModal
          categorySuggestions={categorySuggestions}
          initial={editing}
          onSubmit={async (data) => {
            await api.updateTransaction(id, editing.id, data);
            await refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `cd frontend && npx vitest run src/pages/ProjectDetailPage.test.tsx`
Expected: 4 PASSED

- [ ] **Step 9: Run the full frontend suite and build**

```bash
cd frontend
npm run test
npm run build
```

Expected: all PASSED, build succeeds with no type errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add transaction list, filters, and create/edit/delete form"
```

---

## Task 15: Docker (Dockerfiles, Nginx, Compose)

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `docker-compose.yml`
- Create: `.env.example` (repo root)

**Interfaces:**
- Consumes: the built backend (Tasks 1-8) and frontend (Tasks 9-14).
- Produces: a runnable `docker compose up --build` stack, backend on the internal network, frontend on `:8080` proxying `/api` to the backend.

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create `frontend/nginx.conf`**

```nginx
server {
    listen 80;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

- [ ] **Step 3: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 4: Create `docker-compose.yml`**

```yaml
services:
  backend:
    build: ./backend
    environment:
      DATABASE_URL: sqlite:////data/finance_tracker.db
      JWT_SECRET: ${JWT_SECRET:?serve un JWT_SECRET}
      ADMIN_USERNAME: ${ADMIN_USERNAME:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?serve una ADMIN_PASSWORD}
    volumes:
      - data:/data
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "8080:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  data:
```

- [ ] **Step 5: Create `.env.example` at the repo root**

```
JWT_SECRET=genera-una-stringa-lunga-e-casuale
ADMIN_USERNAME=admin
ADMIN_PASSWORD=cambiami
```

- [ ] **Step 6: Verify the compose file is valid and the stack builds**

```bash
docker compose --env-file .env.example config
docker compose --env-file .env.example up --build -d
curl -f http://localhost:8080/
curl -f http://localhost:8080/api/health
docker compose down
```

Expected: `config` prints the resolved compose file with no errors; both `curl` calls return `200`; `down` stops the stack cleanly. If Docker isn't available in this environment, run this step manually before deploying and note it as pending.

- [ ] **Step 7: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile frontend/nginx.conf docker-compose.yml .env.example
git commit -m "feat(deploy): add Dockerfiles and Docker Compose stack"
```

---

## Task 16: CI/CD (manual GitHub Actions deploy)

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `scripts/deploy.sh`
- Create: `deploy/deploy.env.example`

**Interfaces:**
- Consumes: `docker-compose.yml` (Task 15).
- Produces: a `workflow_dispatch`-only GitHub Actions workflow that joins the Tailscale tailnet and runs `scripts/deploy.sh` against `raspi-gorghy`.

- [ ] **Step 1: Create `scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-raspi-gorghy}"
REMOTE_USER="${REMOTE_USER:-pi}"
REMOTE_DIR="${REMOTE_DIR:-/opt/finance-tracker}"
SSH_KEY="${SSH_PRIVATE_KEY_PATH:-$HOME/.ssh/deploy_key}"
DRY_RUN="${DRY_RUN:-true}"

REMOTE_PROBE_TIMEOUT="${REMOTE_PROBE_TIMEOUT:-10}"
REMOTE_CMD_TIMEOUT="${REMOTE_CMD_TIMEOUT:-60}"
REMOTE_TRANSFER_TIMEOUT="${REMOTE_TRANSFER_TIMEOUT:-120}"
REMOTE_BUILD_TIMEOUT="${REMOTE_BUILD_TIMEOUT:-600}"
SSH_RETRY_COUNT="${SSH_RETRY_COUNT:-3}"
SSH_RETRY_DELAY="${SSH_RETRY_DELAY:-5}"

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o BatchMode=yes)

run_with_retry() {
  local timeout_s="$1"
  shift
  local attempt=1
  while true; do
    if timeout "$timeout_s" "$@"; then
      return 0
    fi
    local exit_code=$?
    if [[ "$exit_code" != 255 && "$exit_code" != 124 ]]; then
      return "$exit_code"
    fi
    if (( attempt >= SSH_RETRY_COUNT )); then
      return "$exit_code"
    fi
    echo "Tentativo $attempt fallito (exit $exit_code), retry tra ${SSH_RETRY_DELAY}s..." >&2
    sleep "$SSH_RETRY_DELAY"
    attempt=$((attempt + 1))
  done
}

echo "Verifico raggiungibilita di $REMOTE_HOST..."
run_with_retry "$REMOTE_PROBE_TIMEOUT" ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" true

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry-run: nessuna modifica remota. Host raggiungibile, lo script termina qui."
  exit 0
fi

echo "Creo la directory remota se manca..."
run_with_retry "$REMOTE_CMD_TIMEOUT" ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" \
  "mkdir -p $REMOTE_DIR"

echo "Sincronizzo i file..."
run_with_retry "$REMOTE_TRANSFER_TIMEOUT" rsync -az -e "ssh ${SSH_OPTS[*]}" \
  --exclude ".git" --exclude "frontend/node_modules" --exclude "backend/.venv" \
  ./ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

echo "Riavvio i container..."
run_with_retry "$REMOTE_BUILD_TIMEOUT" ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" \
  "cd $REMOTE_DIR && docker compose up --build -d"

echo "Deploy completato."
```

- [ ] **Step 2: Make it executable and syntax-check it**

```bash
chmod +x scripts/deploy.sh
bash -n scripts/deploy.sh
```

Expected: `bash -n` prints nothing (no syntax errors).

- [ ] **Step 3: Create `deploy/deploy.env.example`**

```
REMOTE_HOST=raspi-gorghy
REMOTE_USER=pi
REMOTE_DIR=/opt/finance-tracker
REMOTE_PROBE_TIMEOUT=10
REMOTE_CMD_TIMEOUT=60
REMOTE_TRANSFER_TIMEOUT=120
REMOTE_BUILD_TIMEOUT=600
SSH_RETRY_COUNT=3
SSH_RETRY_DELAY=5
```

- [ ] **Step 4: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: "Esegui in modalita dry-run (nessuna modifica remota)"
        type: boolean
        default: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Connetti alla tailnet
        uses: tailscale/github-action@v2
        with:
          oauth-client-id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
          oauth-client-secret: ${{ secrets.TS_OAUTH_CLIENT_SECRET }}
          tags: tag:ci-deploy

      - name: Deploy
        env:
          DRY_RUN: ${{ inputs.dry_run }}
          REMOTE_HOST: raspi-gorghy
          REMOTE_USER: ${{ secrets.DEPLOY_SSH_USER }}
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.DEPLOY_SSH_PRIVATE_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ./scripts/deploy.sh
```

This mirrors dashboard-raspi's pattern: trigger is `workflow_dispatch` only (never `push`/`pull_request`, since the repo is public and this workflow touches Tailscale OAuth + SSH secrets), `dry_run` defaults to `true`, and the Tailscale OAuth client should be scoped to `tag:ci-deploy` with an ACL restricted to port 22 on `raspi-gorghy` (set up once in the Tailscale admin console, outside this repo).

- [ ] **Step 5: Commit**

```bash
git add scripts/deploy.sh deploy/deploy.env.example .github/workflows/deploy.yml
git commit -m "feat(deploy): add manual (workflow_dispatch) GitHub Actions deploy"
```

---

## Task 17: README and final check

**Files:**
- Create: `README.md`
- Verify: `.gitignore` (Task 1) covers everything actually produced

**Interfaces:**
- None — this is documentation only.

- [ ] **Step 1: Create `README.md`**

```markdown
# Finance Tracker

Webapp per tenere sotto controllo le finanze di più progetti indipendenti
(es. un immobile, il portafoglio personale). Login singolo utente, saldo e
andamento per progetto, recap delle ultime transazioni al login.

## Stack

Backend FastAPI + SQLAlchemy 2.0 + SQLite, JWT auth. Frontend React 18 +
Vite + TypeScript + Tailwind CSS + Recharts. Orchestrazione con Docker
Compose.

## Sviluppo locale

### Backend

```bash
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows; su Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
pytest            # tutti i test
pytest -k nome     # match per nome
```

### Frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173, proxy /api -> :8000
npm run build        # type check + build
npm run test          # vitest
```

Al primo avvio del backend viene creato un utente admin da
`ADMIN_USERNAME`/`ADMIN_PASSWORD` (default `admin`/`admin` in locale).

## Docker

```bash
cp .env.example .env   # imposta JWT_SECRET e ADMIN_PASSWORD
docker compose up --build
```

Frontend su `:8080` (proxy verso il backend su `/api`).

## Deploy

Deploy su un Raspberry Pi raggiungibile via Tailscale, tramite
`scripts/deploy.sh` (rsync + `docker compose up --build -d`, con timeout
differenziati e retry sui soli fallimenti di trasporto — variabili in
`deploy/deploy.env.example`).

Il workflow GitHub Actions (`.github/workflows/deploy.yml`) esegue lo
stesso script da un runner che si unisce alla tailnet privata con
`tailscale/github-action`. Il trigger è **solo manuale**
(`workflow_dispatch`, con `dry_run` di default) — il repo è pubblico,
quindi il deploy non parte mai automaticamente da un push o da una PR.

Secret richiesti nel repo GitHub: `TS_OAUTH_CLIENT_ID`,
`TS_OAUTH_CLIENT_SECRET` (scope minimi, tag `tag:ci-deploy` con ACL
ristretta alla porta 22 dell'host target), `DEPLOY_SSH_USER`,
`DEPLOY_SSH_PRIVATE_KEY`.
```

- [ ] **Step 2: Verify `.gitignore` coverage**

Run `git status` from the repo root and confirm `backend/.venv/`, `backend/__pycache__/`, `frontend/node_modules/`, `frontend/dist/`, and any local `.env` are all ignored (not listed as untracked). If anything shows up, add the missing pattern to `.gitignore` from Task 1.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add project README"
```

- [ ] **Step 4: Final full-repo check**

```bash
cd backend && pytest -v
cd ../frontend && npm run test && npm run build
```

Expected: all backend and frontend tests PASS, frontend build succeeds. This is the last task — the app is now feature-complete per the spec and ready for a first manual deploy via the GitHub Actions workflow (with `dry_run: true` first, to confirm `raspi-gorghy` is reachable, before a real run).
