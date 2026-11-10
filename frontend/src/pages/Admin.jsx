import { useEffect, useState } from "react";
import api, { errMsg } from "../api";
import Badge from "../Badge.jsx";

function Requests() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({});
  const load = async () => {
    const [r, s] = await Promise.all([api.get("/admin/leaves", { params: status ? { status } : {} }), api.get("/admin/stats")]);
    setRows(r.data); setStats(s.data);
  };
  useEffect(() => {
    load().catch(() => {});
    const id = setInterval(() => load().catch(() => {}), 8000); // new requests appear automatically
    return () => clearInterval(id);
  }, [status]);

  const review = async (id, action) => {
    const note = prompt(action === "approve" ? "Note for the employee (optional):" : "Reason for rejecting (optional):") ;
    if (note === null) return;
    try { await api.post(`/admin/leaves/${id}/review`, { action, note: note || null }); load(); } catch (e) { alert(errMsg(e)); }
  };

  return (
    <>
      <div className="grid">
        <div className="card bal"><div className="muted">Waiting for review</div><div className="big">{stats.pending ?? "–"}</div></div>
        <div className="card bal"><div className="muted">On leave today</div><div className="big">{stats.on_leave_today ?? "–"}</div></div>
        <div className="card bal"><div className="muted">Active employees</div><div className="big">{stats.employees ?? "–"}</div></div>
      </div>
      <div className="card">
        <div className="between">
          <h3>Leave requests</h3>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pending</option><option value="approved">Approved</option>
            <option value="rejected">Rejected</option><option value="cancelled">Cancelled</option><option value="">All</option>
          </select>
        </div>
        {rows.length === 0 ? <p className="muted">Nothing here. Change the filter to see other requests.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
            <tbody>{rows.map((l) => (
              <tr key={l.id}>
                <td>{l.user_name}</td><td>{l.leave_type}</td><td>{l.start_date} to {l.end_date}</td><td>{l.days}</td>
                <td>{l.reason || "–"}</td><td><Badge status={l.status} /></td>
                <td className="actions">{l.status === "pending" && <>
                  <button className="btn ok sm" onClick={() => review(l.id, "approve")}>Approve</button>
                  <button className="btn danger sm" onClick={() => review(l.id, "reject")}>Reject</button></>}</td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

function Employees() {
  const blank = { name: "", email: "", password: "", department: "", role: "employee" };
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState(null);
  const load = () => api.get("/admin/users").then((r) => setUsers(r.data));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault(); setMsg(null);
    try { await api.post("/admin/users", form); setForm(blank); setMsg({ ok: true, t: "Employee added." }); load(); }
    catch (err) { setMsg({ ok: false, t: errMsg(err) }); }
  };
  const toggle = async (u) => {
    try { await api.patch(`/admin/users/${u.id}`, { is_active: !u.is_active }); load(); } catch (e) { alert(errMsg(e)); }
  };
  const reset = async (u) => {
    const password = prompt(`New password for ${u.name} (min 6 characters):`);
    if (!password) return;
    try { await api.patch(`/admin/users/${u.id}`, { password }); alert("Password updated."); } catch (e) { alert(errMsg(e)); }
  };

  return (
    <div className="two">
      <form className="card" onSubmit={add}>
        <h3>Add employee</h3>
        <p className="small muted">Employees can also sign up themselves on the login page.</p>
        <label>Full name<input value={form.name} onChange={set("name")} required /></label>
        <label>Email<input type="email" value={form.email} onChange={set("email")} required /></label>
        <label>Temporary password<input type="text" minLength="6" value={form.password} onChange={set("password")} required /></label>
        <label>Department<input value={form.department} onChange={set("department")} /></label>
        {msg && <p className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.t}</p>}
        <button className="btn primary">Add employee</button>
      </form>
      <div className="card">
        <h3>Employees</h3>
        <div className="scroll"><table>
          <thead><tr><th>Name</th><th>Department</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}<div className="small muted">{u.email}</div></td><td>{u.department || "–"}</td><td>{u.role}</td>
              <td><Badge status={u.is_active ? "approved" : "cancelled"} /></td>
              <td className="actions">
                <button className="btn ghost sm" onClick={() => reset(u)}>Reset password</button>
                <button className="btn ghost sm" onClick={() => toggle(u)}>{u.is_active ? "Deactivate" : "Activate"}</button>
              </td>
            </tr>))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

function Types() {
  const [types, setTypes] = useState([]);
  const [nt, setNt] = useState({ name: "", days_per_year: 0 });
  const load = () => api.get("/leave-types").then((r) => setTypes(r.data));
  useEffect(() => { load(); }, []);
  const edit = (id, k, v) => setTypes(types.map((t) => (t.id === id ? { ...t, [k]: v } : t)));
  const save = async (t) => {
    try { await api.put(`/admin/leave-types/${t.id}`, { name: t.name, days_per_year: Number(t.days_per_year) }); alert("Saved."); } catch (e) { alert(errMsg(e)); }
  };
  const add = async (e) => {
    e.preventDefault();
    try { await api.post("/admin/leave-types", { name: nt.name, days_per_year: Number(nt.days_per_year) }); setNt({ name: "", days_per_year: 0 }); load(); }
    catch (err) { alert(errMsg(err)); }
  };
  return (
    <div className="two">
      <div className="card">
        <h3>Leave types and yearly allowance</h3>
        <table>
          <thead><tr><th>Name</th><th>Days per year</th><th></th></tr></thead>
          <tbody>{types.map((t) => (
            <tr key={t.id}>
              <td><input value={t.name} onChange={(e) => edit(t.id, "name", e.target.value)} /></td>
              <td><input type="number" min="0" value={t.days_per_year} onChange={(e) => edit(t.id, "days_per_year", e.target.value)} /></td>
              <td><button className="btn ghost sm" onClick={() => save(t)}>Save</button></td>
            </tr>))}
          </tbody>
        </table>
      </div>
      <form className="card" onSubmit={add}>
        <h3>Add leave type</h3>
        <label>Name<input value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} required /></label>
        <label>Days per year<input type="number" min="0" value={nt.days_per_year} onChange={(e) => setNt({ ...nt, days_per_year: e.target.value })} /></label>
        <button className="btn primary">Add leave type</button>
      </form>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("requests");
  return (
    <>
      <div className="tabs">
        {[["requests", "Requests"], ["employees", "Employees"], ["types", "Leave types"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "requests" && <Requests />}
      {tab === "employees" && <Employees />}
      {tab === "types" && <Types />}
    </>
  );
}