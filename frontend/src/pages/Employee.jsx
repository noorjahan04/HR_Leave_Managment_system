import { useEffect, useRef, useState } from "react";
import api, { errMsg } from "../api";
import Badge from "../Badge.jsx";
import { MonthlyBars, TypeBars, UsageDonut } from "../Charts.jsx";

const today = () => new Date().toISOString().slice(0, 10);
const POLL_MS = 8000;

export default function Employee() {
  const [types, setTypes] = useState([]);
  const [bal, setBal] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [notices, setNotices] = useState([]);
  const [form, setForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
  const [msg, setMsg] = useState(null);
  const prev = useRef(null);

  const load = async () => {
    const [t, b, l, m] = await Promise.all([
      api.get("/leave-types"), api.get("/leaves/balance"), api.get("/leaves/mine"), api.get("/leaves/monthly"),
    ]);
    // tell the employee when HR has just decided on a request
    if (prev.current) {
      const fresh = l.data.filter((x) => prev.current[x.id] === "pending" && (x.status === "approved" || x.status === "rejected"));
      if (fresh.length)
        setNotices((n) => [...n, ...fresh.map((x) => ({
          id: x.id, ok: x.status === "approved",
          text: `Your ${x.leave_type} (${x.start_date} to ${x.end_date}) was ${x.status}${x.review_note ? `: ${x.review_note}` : "."}`,
        }))]);
    }
    prev.current = Object.fromEntries(l.data.map((x) => [x.id, x.status]));
    setTypes(t.data); setBal(b.data); setLeaves(l.data); setMonthly(m.data);
    setForm((f) => ({ ...f, leave_type_id: f.leave_type_id || t.data[0]?.id || "" }));
  };

  useEffect(() => {
    load().catch(() => {});
    const id = setInterval(() => load().catch(() => {}), POLL_MS); // live updates
    return () => clearInterval(id);
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post("/leaves", { ...form, leave_type_id: Number(form.leave_type_id) });
      setMsg({ ok: true, t: "Request sent to HR. You'll see the decision here." });
      setForm((f) => ({ ...f, start_date: "", end_date: "", reason: "" }));
      load();
    } catch (err) { setMsg({ ok: false, t: errMsg(err) }); }
  };

  const cancel = async (id) => {
    if (!confirm("Cancel this leave request?")) return;
    try { await api.post(`/leaves/${id}/cancel`); load(); } catch (err) { alert(errMsg(err)); }
  };

  return (
    <>
      {notices.map((n, i) => (
        <div key={`${n.id}-${i}`} className={`toast ${n.ok ? "ok" : "err"}`}>
          <span>{n.text}</span>
          <button className="btn ghost sm" onClick={() => setNotices(notices.filter((_, j) => j !== i))}>Dismiss</button>
        </div>
      ))}

      <h2>Your balance this year</h2>
      <div className="grid">
        {bal.map((b) => {
          const used = b.allowance > 0 ? Math.round((b.approved / b.allowance) * 100) : 0;
          return (
            <div className="card bal" key={b.leave_type_id}>
              <div className="muted">{b.leave_type}</div>
              <div className="big">{b.remaining}<span> of {b.allowance} days left</span></div>
              <div className="bar" role="progressbar" aria-valuenow={used} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${used}%` }} /></div>
              <div className="small muted">{used}% used · {b.approved} taken · {b.pending} awaiting approval</div>
            </div>
          );
        })}
      </div>

      {bal.length > 0 && (
        <div className="charts">
          <UsageDonut bal={bal} />
          <TypeBars bal={bal} />
          <MonthlyBars data={monthly} />
        </div>
      )}

      <div className="two">
        <form className="card" onSubmit={submit}>
          <h3>Request time off</h3>
          <label>Leave type
            <select value={form.leave_type_id} onChange={set("leave_type_id")} required>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div className="row">
            <label>From<input type="date" min={today()} value={form.start_date} onChange={set("start_date")} required /></label>
            <label>To<input type="date" min={form.start_date || today()} value={form.end_date} onChange={set("end_date")} required /></label>
          </div>
          <label>Reason (optional)<textarea rows="3" value={form.reason} onChange={set("reason")} /></label>
          {msg && <p className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.t}</p>}
          <button className="btn primary" type="submit">Send request</button>
          <p className="small muted">Weekends are not counted.</p>
        </form>

        <div className="card">
          <h3>Your requests</h3>
          {leaves.length === 0 ? <p className="muted">No requests yet. Use the form to take your first day off.</p> : (
            <div className="scroll"><table>
              <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td>{l.leave_type}</td>
                    <td>{l.start_date} to {l.end_date}</td>
                    <td>{l.days}</td>
                    <td><Badge status={l.status} />{l.review_note && <div className="small muted">{l.review_note}</div>}</td>
                    <td>{(l.status === "pending" || l.status === "approved") && l.start_date >= today() &&
                      <button className="btn ghost sm" onClick={() => cancel(l.id)}>Cancel</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </>
  );
}