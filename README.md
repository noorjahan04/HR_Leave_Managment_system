# HR Leave Management System

A full-stack web app where employees request leave and HR approves or rejects it. Balances, notifications and charts update live.

Built with **FastAPI**, **PostgreSQL** and **React (Vite)**.

## Features

**Employee**
- Sign up and log in
- See leave balance for every leave type (Annual, Sick, Casual, Unpaid)
- Request leave (weekends are not counted; overlapping dates and over-balance requests are blocked)
- Cancel pending or upcoming requests
- Live notification when HR approves or rejects a request
- Dashboard charts built from real data:
  - Overall usage donut (% of leave taken)
  - Usage by leave type (%)
  - Days off by month

**HR**
- Live list of leave requests with a pending counter in the navbar
- Approve or reject with a note
- Add employees, reset passwords, activate or deactivate accounts
- Edit leave types and yearly allowances
- Dashboard stats: pending requests, people on leave today, active employees

**Security**
- Passwords stored as bcrypt hashes
- JWT login tokens
- Role-based access: every `/admin/*` API is HR-only on the server
- Public signup always creates an employee, never an HR
- Only one HR account is allowed through the app

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Uvicorn, SQLAlchemy 2, Pydantic v2 |
| Database | PostgreSQL (psycopg2) |
| Auth | PyJWT, bcrypt |
| Frontend | React 18, Vite, React Router, Axios |
| Charts | Recharts |

## Project structure

```
hr-leave-system/
├── backend/
│   ├── app/
│   │   ├── main.py        # app setup, CORS, seed data
│   │   ├── database.py    # PostgreSQL connection
│   │   ├── models.py      # database tables
│   │   ├── schemas.py     # request/response validation
│   │   ├── security.py    # password hashing, JWT
│   │   ├── deps.py        # current user and HR-only checks
│   │   └── routes.py      # all API endpoints
│   ├── alembic/           # database migrations
│   │   ├── env.py
│   │   └── versions/      # one file per schema change
│   ├── alembic.ini
│   ├── schema.sql         # optional manual SQL schema (Alembic is preferred)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/         # Login, Signup, Employee, Admin
    │   ├── Charts.jsx     # donut and bar charts
    │   ├── App.jsx, auth.jsx, api.js
    │   └── styles.css
    └── package.json
```

## Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- PostgreSQL 13 or newer

## Setup

### 1. Create the database

```bash
psql -U postgres
CREATE DATABASE hr_leave;
\q
```

Tables are created by Alembic migrations (step 2). Demo data is added automatically the first time the backend starts.

### 2. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac / Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env      # Windows: copy .env.example .env
```

Edit `backend/.env`:

```
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/hr_leave
SECRET_KEY=change-this-to-a-long-random-string
```

Create the tables with Alembic (run once, and again after every new migration):

```bash
alembic upgrade head
```

Start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs

### 3. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

To point the frontend at a different API, set `VITE_API_URL` in `frontend/.env`.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| HR | admin@company.com | admin123 |
| Employee | john@company.com | john123 |

Change these and the `SECRET_KEY` before using the app for real.

## Typical flow

1. An employee signs up and requests leave. The request is saved as `pending`.
2. HR sees it in the console within a few seconds and approves or rejects it.
3. The employee's balance, charts and notification update automatically.

The frontend refreshes data every 8 seconds.

## Database schema

| Table | Purpose |
|---|---|
| `users` | name, email, bcrypt password hash, `role` (`employee` or `hr`), department, `is_active` |
| `leave_types` | leave type name and `days_per_year` |
| `leave_requests` | user, leave type, dates, working days, reason, `status` (`pending`, `approved`, `rejected`, `cancelled`), reviewer and note |
| `leave_adjustments` | extra or fewer days for one employee, leave type and year |

Remaining balance:

```
days_per_year + adjustments - approved days - pending days   (current year)
```

A user is HR only because `users.role = 'hr'`. The email address does not matter.

## Database migrations (Alembic)

Table structure is versioned with [Alembic](https://alembic.sqlalchemy.org). Run all commands from the `backend` folder.

| Task | Command |
|---|---|
| Create / update tables | `alembic upgrade head` |
| Change a model, then generate a migration | `alembic revision --autogenerate -m "add phone to users"` |
| Roll back the last migration | `alembic downgrade -1` |
| See current version | `alembic current` |
| See history | `alembic history` |
| Preview SQL without running it | `alembic upgrade head --sql` |

Workflow for a schema change:
1. Edit `backend/app/models.py` (for example add a column).
2. Run `alembic revision --autogenerate -m "describe the change"`.
3. Open the new file in `backend/alembic/versions/` and check it.
4. Run `alembic upgrade head`.

If your database was created by an older version of this project (tables already exist), run `alembic stamp head` once instead of `upgrade head`. This marks the database as up to date without recreating tables.

## Working with the data in SQL

```bash
psql -U postgres -d hr_leave
```

```sql
-- View users and requests
SELECT id, name, email, role, is_active FROM users;
SELECT r.id, u.name, t.name AS type, r.start_date, r.end_date, r.days, r.status
FROM leave_requests r
JOIN users u ON u.id = r.user_id
JOIN leave_types t ON t.id = r.leave_type_id
ORDER BY r.id DESC;

-- Change yearly allowance for everyone
UPDATE leave_types SET days_per_year = 24 WHERE name = 'Annual Leave';

-- Give one employee 5 extra days (use a negative number to remove days)
INSERT INTO leave_adjustments (user_id, leave_type_id, year, extra_days, note)
VALUES (2, 1, 2026, 5, 'Carry-over');

-- Approve or reject a request
UPDATE leave_requests SET status = 'approved', review_note = 'OK' WHERE id = 1;

-- Make an existing user the HR
UPDATE users SET role = 'hr' WHERE email = 'newhr@company.com';

-- Deactivate a user
UPDATE users SET is_active = FALSE WHERE id = 2;
```

Passwords are bcrypt hashes. To reset one in SQL, generate a hash first:

```bash
python -c "import bcrypt;print(bcrypt.hashpw(b'NewPass123',bcrypt.gensalt()).decode())"
```

```sql
UPDATE users SET password_hash = '<paste hash>' WHERE email = 'john@company.com';
```

## API overview

| Method | Endpoint | Access |
|---|---|---|
| POST | `/auth/signup` | public (creates an employee) |
| POST | `/auth/login` | public |
| GET | `/auth/me` | logged in |
| GET | `/leave-types` | logged in |
| GET | `/leaves/balance`, `/leaves/mine`, `/leaves/monthly` | logged in |
| POST | `/leaves`, `/leaves/{id}/cancel` | logged in |
| GET | `/admin/stats`, `/admin/leaves`, `/admin/users` | HR only |
| POST | `/admin/leaves/{id}/review` | HR only |
| POST / PATCH | `/admin/users`, `/admin/users/{id}` | HR only |
| POST / PUT | `/admin/leave-types`, `/admin/leave-types/{id}` | HR only |

Full interactive docs are at `/docs` when the backend is running.

## Troubleshooting

**`pip install` fails building `pydantic-core` or `psycopg2-binary`**
You are likely on a very new Python version. Use the unpinned `requirements.txt` in this repo, or install Python 3.12 or 3.13.

**Login shows "Is the backend running?" and the backend log shows `OPTIONS ... 400`**
CORS problem. The backend allows any `localhost` port, so make sure you are running the latest `backend/app/main.py`.

**`password authentication failed`**
The password in `DATABASE_URL` does not match your PostgreSQL password. If it contains special characters such as `@` or `#`, URL-encode them.

**Port 5173 already in use**
Vite will pick the next free port (for example 5174). Use the URL it prints.

## Deployment notes

- Set a strong `SECRET_KEY` and use a managed PostgreSQL database
- Add your frontend URL to the CORS settings in `backend/app/main.py`
- Set `VITE_API_URL` in `frontend/.env`, then run `npm run build` and serve the `dist` folder
- Run the backend with `uvicorn app.main:app --host 0.0.0.0 --port 8000` behind HTTPS

## License

Add your preferred license here (for example MIT).