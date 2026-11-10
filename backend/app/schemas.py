from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: str
    department: Optional[str] = None
    is_active: bool


class UserCreate(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)
    role: Literal["employee", "hr"] = "employee"
    department: Optional[str] = None


class SignupIn(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)
    department: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[Literal["employee", "hr"]] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=6)


class LeaveTypeIn(BaseModel):
    name: str = Field(min_length=1)
    days_per_year: int = Field(ge=0)


class LeaveTypeOut(LeaveTypeIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class LeaveIn(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    leave_type_id: int
    leave_type: str
    start_date: date
    end_date: date
    days: int
    reason: Optional[str] = None
    status: str
    review_note: Optional[str] = None
    created_at: datetime


class ReviewIn(BaseModel):
    action: Literal["approve", "reject"]
    note: Optional[str] = None