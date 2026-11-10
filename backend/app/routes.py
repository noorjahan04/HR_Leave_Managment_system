from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from .database import get_db
from .deps import current_user, hr_only
from .models import LeaveAdjustment, LeaveRequest, LeaveType, User
from .schemas import (LeaveIn, LeaveOut, LeaveTypeIn, LeaveTypeOut, LoginIn,
                      ReviewIn, SignupIn, UserCreate, UserOut, UserUpdate)
from .security import create_token, hash_password, verify_password

public = APIRouter()
leaves = APIRouter(prefix="/leaves", tags=["leaves"])
admin = APIRouter(prefix="/admin", tags=["admin"])


# ---------- helpers ----------
def count_workdays(start: date, end: date) -> int:
    n, d = 0, start
    while d <= end:
        if d.weekday() < 5:  # Mon-Fri
            n += 1
        d += timedelta(days=1)
    return n


def to_out(l: LeaveRequest) -> LeaveOut:
    return LeaveOut(id=l.id, user_id=l.user_id, user_name=l.user.name, leave_type_id=l.leave_type_id,
                    leave_type=l.leave_type.name, start_date=l.start_date, end_date=l.end_date, days=l.days,
                    reason=l.reason, status=l.status, review_note=l.review_note, created_at=l.created_at)


def _sum_days(db, uid, tid, status, year):
    return db.query(func.coalesce(func.sum(LeaveRequest.days), 0)).filter(
        LeaveRequest.user_id == uid, LeaveRequest.leave_type_id == tid, LeaveRequest.status == status,
        func.extract("year", LeaveRequest.start_date) == year).scalar()


def balances(db: Session, uid: int, year: int | None = None):
    year = year or date.today().year
    out = []
    for t in db.query(LeaveType).order_by(LeaveType.id):
        extra = db.query(func.coalesce(func.sum(LeaveAdjustment.extra_days), 0)).filter(
            LeaveAdjustment.user_id == uid, LeaveAdjustment.leave_type_id == t.id,
            LeaveAdjustment.year == year).scalar()
        allowance = t.days_per_year + extra
        approved, pending = _sum_days(db, uid, t.id, "approved", year), _sum_days(db, uid, t.id, "pending", year)
        out.append(dict(leave_type_id=t.id, leave_type=t.name, allowance=allowance, approved=approved,
                        pending=pending, remaining=allowance - approved - pending))
    return out


# ---------- public / auth ----------
@public.post("/auth/login", tags=["auth"])
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password.")
    if not user.is_active:
        raise HTTPException(403, "This account is deactivated.")
    return {"token": create_token(user.id), "user": UserOut.model_validate(user)}


@public.post("/auth/signup", tags=["auth"])
def signup(data: SignupIn, db: Session = Depends(get_db)):
    """Public sign-up. Always creates an EMPLOYEE account (there is only one HR)."""
    if db.query(User).filter(func.lower(User.email) == data.email.lower()).first():
        raise HTTPException(400, "An account with this email already exists.")
    user = User(name=data.name.strip(), email=data.email.lower(), password_hash=hash_password(data.password),
                role="employee", department=data.department)
    db.add(user); db.commit(); db.refresh(user)
    return {"token": create_token(user.id), "user": UserOut.model_validate(user)}


@public.get("/auth/me", response_model=UserOut, tags=["auth"])
def me(user: User = Depends(current_user)):
    return user


@public.get("/leave-types", response_model=list[LeaveTypeOut], tags=["leaves"])
def list_types(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.query(LeaveType).order_by(LeaveType.id).all()


# ---------- employee ----------
@leaves.get("/balance")
def my_balance(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return balances(db, user.id)


@leaves.get("/monthly")
def my_monthly(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Working days taken (approved) and waiting (pending) per month, current year."""
    year = date.today().year
    names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    approved, pending = [0] * 12, [0] * 12
    rows = db.query(LeaveRequest).filter(
        LeaveRequest.user_id == user.id, LeaveRequest.status.in_(["approved", "pending"]),
        func.extract("year", LeaveRequest.start_date) == year).all()
    for r in rows:
        d = r.start_date
        while d <= r.end_date:
            if d.weekday() < 5:
                (approved if r.status == "approved" else pending)[d.month - 1] += 1
            d += timedelta(days=1)
    return [{"month": names[i], "approved": approved[i], "pending": pending[i]} for i in range(12)]


@leaves.get("/mine", response_model=list[LeaveOut])
def my_leaves(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.query(LeaveRequest).filter(LeaveRequest.user_id == user.id).order_by(LeaveRequest.id.desc()).all()
    return [to_out(r) for r in rows]


@leaves.post("", response_model=LeaveOut)
def apply_leave(data: LeaveIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if data.end_date < data.start_date:
        raise HTTPException(400, "End date must be on or after the start date.")
    if data.start_date.year != data.end_date.year:
        raise HTTPException(400, "A request cannot span two years. Please split it.")
    if data.start_date < date.today():
        raise HTTPException(400, "Start date cannot be in the past.")
    ltype = db.get(LeaveType, data.leave_type_id)
    if not ltype:
        raise HTTPException(404, "Leave type not found.")
    days = count_workdays(data.start_date, data.end_date)
    if days == 0:
        raise HTTPException(400, "The selected dates only include weekends.")
    overlap = db.query(LeaveRequest).filter(
        LeaveRequest.user_id == user.id, LeaveRequest.status.in_(["pending", "approved"]),
        LeaveRequest.start_date <= data.end_date, LeaveRequest.end_date >= data.start_date).first()
    if overlap:
        raise HTTPException(400, "You already have a leave request for these dates.")
    bal = next(b for b in balances(db, user.id, data.start_date.year) if b["leave_type_id"] == ltype.id)
    if days > bal["remaining"]:
        raise HTTPException(400, f"Not enough {ltype.name} balance. You have {bal['remaining']} day(s) left.")
    leave = LeaveRequest(user_id=user.id, leave_type_id=ltype.id, start_date=data.start_date,
                         end_date=data.end_date, days=days, reason=data.reason, status="pending")
    db.add(leave); db.commit(); db.refresh(leave)
    return to_out(leave)


@leaves.post("/{leave_id}/cancel", response_model=LeaveOut)
def cancel_leave(leave_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    leave = db.get(LeaveRequest, leave_id)
    if not leave or leave.user_id != user.id:
        raise HTTPException(404, "Leave request not found.")
    if leave.status not in ("pending", "approved") or leave.start_date < date.today():
        raise HTTPException(400, "This request can no longer be cancelled.")
    leave.status = "cancelled"
    db.commit(); db.refresh(leave)
    return to_out(leave)


# ---------- HR ----------
@admin.get("/stats")
def stats(db: Session = Depends(get_db), _: User = Depends(hr_only)):
    today = date.today()
    return {
        "pending": db.query(LeaveRequest).filter(LeaveRequest.status == "pending").count(),
        "on_leave_today": db.query(LeaveRequest).filter(
            LeaveRequest.status == "approved", LeaveRequest.start_date <= today,
            LeaveRequest.end_date >= today).count(),
        "employees": db.query(User).filter(User.is_active.is_(True)).count(),
    }


@admin.get("/leaves", response_model=list[LeaveOut])
def all_leaves(status: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(hr_only)):
    q = db.query(LeaveRequest)
    if status:
        q = q.filter(LeaveRequest.status == status)
    return [to_out(r) for r in q.order_by(LeaveRequest.id.desc()).all()]


@admin.post("/leaves/{leave_id}/review", response_model=LeaveOut)
def review_leave(leave_id: int, data: ReviewIn, db: Session = Depends(get_db), hr: User = Depends(hr_only)):
    leave = db.get(LeaveRequest, leave_id)
    if not leave:
        raise HTTPException(404, "Leave request not found.")
    if leave.status != "pending":
        raise HTTPException(400, f"This request is already {leave.status}.")
    leave.status = "approved" if data.action == "approve" else "rejected"
    leave.reviewed_by, leave.review_note = hr.id, data.note
    db.commit(); db.refresh(leave)
    return to_out(leave)


@admin.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(hr_only)):
    return db.query(User).order_by(User.id).all()


@admin.post("/users", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(hr_only)):
    if db.query(User).filter(func.lower(User.email) == data.email.lower()).first():
        raise HTTPException(400, "A user with this email already exists.")
    if data.role == "hr" and db.query(User).filter(User.role == "hr", User.is_active.is_(True)).count() > 0:
        raise HTTPException(400, "Only one HR account is allowed.")
    user = User(name=data.name, email=data.email.lower(), password_hash=hash_password(data.password),
                role=data.role, department=data.department)
    db.add(user); db.commit(); db.refresh(user)
    return user


@admin.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), hr: User = Depends(hr_only)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found.")
    if user.id == hr.id and (data.is_active is False or data.role == "employee"):
        raise HTTPException(400, "You cannot deactivate or demote yourself.")
    if data.role == "hr" and user.role != "hr" and \
            db.query(User).filter(User.role == "hr", User.is_active.is_(True)).count() > 0:
        raise HTTPException(400, "Only one HR account is allowed.")
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "password":
            user.password_hash = hash_password(v)
        else:
            setattr(user, k, v)
    db.commit(); db.refresh(user)
    return user


@admin.post("/leave-types", response_model=LeaveTypeOut)
def create_type(data: LeaveTypeIn, db: Session = Depends(get_db), _: User = Depends(hr_only)):
    if db.query(LeaveType).filter(func.lower(LeaveType.name) == data.name.lower()).first():
        raise HTTPException(400, "This leave type already exists.")
    t = LeaveType(**data.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return t


@admin.put("/leave-types/{type_id}", response_model=LeaveTypeOut)
def update_type(type_id: int, data: LeaveTypeIn, db: Session = Depends(get_db), _: User = Depends(hr_only)):
    t = db.get(LeaveType, type_id)
    if not t:
        raise HTTPException(404, "Leave type not found.")
    t.name, t.days_per_year = data.name, data.days_per_year
    db.commit(); db.refresh(t)
    return t