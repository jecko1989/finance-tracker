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
