# HR Leave Management System
FastAPI + PostgreSQL (backend) and React + Vite (frontend).

## Requirements
Python 3.10+, Node.js 18+, PostgreSQL 13+

## 1. Create the database
    psql -U postgres
    CREATE DATABASE hr_leave;
    \q
(Tables and demo data are created automatically when the backend first starts.)

## 2. Run the backend
    cd backend
    python -m venv venv
    # Windows: venv\Scripts\activate      Mac/Linux: source venv/bin/activate
    pip install -r requirements.txt
    # edit backend/.env -> set your PostgreSQL password in DATABASE_URL
    uvicorn app.main:app --reload --port 8000
API: http://localhost:8000  |  Interactive docs: http://localhost:8000/docs

## 3. Run the frontend (new terminal)
    cd frontend
    npm install
    npm run dev
Open http://localhost:5173

## Demo logins
HR:       admin@company.com / admin123
Employee: john@company.com  / john123

## How to use
Employee: see balances, request leave (weekends are skipped), cancel pending/future requests.
HR: Requests tab (approve/reject), Employees tab (add, reset password, deactivate), Leave types tab (change yearly days).

## Updating data with SQL
    psql -U postgres -d hr_leave

Look at data:
    SELECT id, name, email, role, is_active FROM users;
    SELECT * FROM leave_types;
    SELECT r.id, u.name, t.name AS type, r.start_date, r.end_date, r.days, r.status
      FROM leave_requests r JOIN users u ON u.id=r.user_id JOIN leave_types t ON t.id=r.leave_type_id
      ORDER BY r.id DESC;

Change yearly allowance for everyone:
    UPDATE leave_types SET days_per_year = 24 WHERE name = 'Annual Leave';

Give ONE employee extra days (use a negative number to remove days):
    INSERT INTO leave_adjustments (user_id, leave_type_id, year, extra_days, note)
    VALUES (2, 1, 2026, 5, 'Carry-over from last year');

Approve / reject a request:
    UPDATE leave_requests SET status='approved', review_note='OK' WHERE id = 1;
    UPDATE leave_requests SET status='rejected', review_note='Team deadline' WHERE id = 1;

Edit an employee:
    UPDATE users SET department='Finance' WHERE email='john@company.com';
    UPDATE users SET role='hr' WHERE email='john@company.com';
    UPDATE users SET is_active=FALSE WHERE id = 2;

Reset a password (passwords are bcrypt hashes, so generate the hash first):
    python -c "import bcrypt;print(bcrypt.hashpw(b'NewPass123',bcrypt.gensalt()).decode())"
    UPDATE users SET password_hash='<paste hash>' WHERE email='john@company.com';

Delete data (tip: run inside BEGIN; ... COMMIT; and check first):
    DELETE FROM leave_requests WHERE status='cancelled';

Balance = days_per_year + adjustments - approved days - pending days (current year).

## Deploy notes
Change SECRET_KEY in backend/.env. Add your frontend URL to allow_origins in backend/app/main.py.
Set VITE_API_URL in frontend/.env to your API URL and run `npm run build`.
