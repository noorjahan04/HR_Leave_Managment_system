import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { errMsg } from "../api";

export default function Signup() {
  const { user, signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", department: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  if (user) return <Navigate to={user.role === "hr" ? "/admin" : "/"} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    try {
      await signup({ name: form.name, email: form.email, department: form.department || null, password: form.password });
      nav("/");
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <div className="login-wrap">
      <form className="login card" onSubmit={submit}>
        <h1>Create your account</h1>
        <p className="muted">Sign up as an employee to request leave. HR accounts are set up by the company.</p>
        <label>Full name<input value={form.name} onChange={set("name")} required autoFocus /></label>
        <label>Work email<input type="email" value={form.email} onChange={set("email")} required /></label>
        <label>Department (optional)<input value={form.department} onChange={set("department")} /></label>
        <label>Password<input type="password" minLength="6" value={form.password} onChange={set("password")} required /></label>
        <label>Confirm password<input type="password" minLength="6" value={form.confirm} onChange={set("confirm")} required /></label>
        {error && <p className="msg err">{error}</p>}
        <button className="btn primary" type="submit">Create account</button>
        <p className="small">Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}