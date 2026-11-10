from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, SessionLocal, engine
from .models import LeaveType, User
from .routes import admin, leaves, public
from .security import hash_password


def seed():
    """Creates default leave types and demo users the first time the app starts."""
    db = SessionLocal()
    try:
        if db.query(LeaveType).count() == 0:
            db.add_all([LeaveType(name="Annual Leave", days_per_year=20),
                        LeaveType(name="Sick Leave", days_per_year=10),
                        LeaveType(name="Casual Leave", days_per_year=8),
                        LeaveType(name="Unpaid Leave", days_per_year=30)])
        if db.query(User).count() == 0:
            db.add_all([
                User(name="HR Admin", email="admin@company.com", password_hash=hash_password("admin123"),
                     role="hr", department="Human Resources"),
                User(name="John Employee", email="john@company.com", password_hash=hash_password("john123"),
                     role="employee", department="Engineering")])
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)  # creates tables if they don't exist
    seed()
    yield


app = FastAPI(title="HR Leave Management API", lifespan=lifespan)
# Allow the React dev server on ANY localhost port (5173, 5174, ...)
app.add_middleware(CORSMiddleware, allow_origins=[],
                   allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(public)
app.include_router(leaves)
app.include_router(admin)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}