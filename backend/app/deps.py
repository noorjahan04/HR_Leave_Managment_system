import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import User
from .security import SECRET_KEY

bearer = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    try:
        uid = int(jwt.decode(creds.credentials, SECRET_KEY, algorithms=["HS256"])["sub"])
    except Exception:
        raise HTTPException(401, "Session expired. Please log in again.")
    user = db.get(User, uid)
    if not user or not user.is_active:
        raise HTTPException(401, "Account not found or deactivated.")
    return user


def hr_only(user: User = Depends(current_user)) -> User:
    if user.role != "hr":
        raise HTTPException(403, "Only HR can do this.")
    return user
