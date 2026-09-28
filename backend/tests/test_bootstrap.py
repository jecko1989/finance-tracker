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
