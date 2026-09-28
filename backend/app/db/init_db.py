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
