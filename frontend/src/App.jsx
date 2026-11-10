import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import api from "./api";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Employee from "./pages/Employee.jsx";
import Admin from "./pages/Admin.jsx";

function Protected({ hr, employee, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted pad">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (hr && user.role !== "hr") return <Navigate to="/" replace />;
  if (employee && user.role === "hr") return <Navigate to="/admin" replace />;
  return children;
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(0);

  // HR sees a live count of requests waiting for review
  useEffect(() => {
    if (user.role !== "hr") return;
    const tick = () => api.get("/admin/stats").then((r) => setPending(r.data.pending)).catch(() => {});
    tick();
    const id = setInterval(tick, 8000);
    return () => clearInterval(id);
  }, [user.role]);

  return (
    <>
      <header className="topbar">
        <div className="brand">Leave Desk</div>
        <nav>
          {user.role !== "hr" && <NavLink to="/" end>My leave</NavLink>}
          {user.role === "hr" && (
            <NavLink to="/admin">HR console{pending > 0 && <span className="count">{pending}</span>}</NavLink>
          )}
        </nav>
        <div className="who">
          <span>{user.name}</span>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<Protected employee><Shell><Employee /></Shell></Protected>} />
      <Route path="/admin" element={<Protected hr><Shell><Admin /></Shell></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}