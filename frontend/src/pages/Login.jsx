import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { errMsg } from "../api";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  if (user) return <Navigate to={user.role === "hr" ? "/admin" : "/"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try { const u = await login(email, password); nav(u.role === "hr" ? "/admin" : "/"); } catch (err) { setError(errMsg(err)); }
  };

  return (
    <div className="login-wrap">
      <form className="login card" onSubmit={submit}>
        <h1>Leave Desk</h1>
        <p className="muted">Sign in to request time off or review your team's requests.</p>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="msg err">{error}</p>}
        <button className="btn primary" type="submit">Sign in</button>
        <p className="small">New employee? <Link to="/signup">Create an account</Link></p>
        <p className="muted small">Demo: admin@company.com / admin123 (HR) · john@company.com / john123</p>
      </form>
    </div>
  );
}