import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLOR = { taken: "#0e5c6b", pending: "#e0a030", left: "#d5dbe3" };
const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

// Overall usage: how much of the whole year's allowance is taken / pending / left
export function UsageDonut({ bal }) {
  const total = bal.reduce((s, b) => s + b.allowance, 0);
  const taken = bal.reduce((s, b) => s + b.approved, 0);
  const pending = bal.reduce((s, b) => s + b.pending, 0);
  const left = Math.max(total - taken - pending, 0);
  const data = [
    { name: "Taken", value: taken, color: COLOR.taken },
    { name: "Pending approval", value: pending, color: COLOR.pending },
    { name: "Remaining", value: left, color: COLOR.left },
  ];
  return (
    <div className="card chart-card">
      <h3>Overall usage</h3>
      <div className="donut">
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none">
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [`${v} days (${pct(v, total)}%)`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center"><strong>{pct(taken, total)}%</strong><span>of leave taken</span></div>
      </div>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.name}><i style={{ background: d.color }} />{d.name}<b>{d.value} days · {pct(d.value, total)}%</b></li>
        ))}
      </ul>
    </div>
  );
}

// Per leave type, as a percentage of that type's allowance
export function TypeBars({ bal }) {
  const data = bal.filter((b) => b.allowance > 0).map((b) => ({
    name: b.leave_type.replace(" Leave", ""),
    Taken: pct(b.approved, b.allowance),
    Pending: pct(b.pending, b.allowance),
    Remaining: Math.max(100 - pct(b.approved, b.allowance) - pct(b.pending, b.allowance), 0),
  }));
  return (
    <div className="card chart-card">
      <h3>Usage by leave type</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="#e6e9ef" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} />
          <YAxis type="category" dataKey="name" width={62} fontSize={12} />
          <Tooltip formatter={(v) => `${v}%`} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Taken" stackId="a" fill={COLOR.taken} />
          <Bar dataKey="Pending" stackId="a" fill={COLOR.pending} />
          <Bar dataKey="Remaining" stackId="a" fill={COLOR.left} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Working days taken per month this year
export function MonthlyBars({ data }) {
  return (
    <div className="card chart-card wide">
      <h3>Days off by month</h3>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ left: -16, right: 8 }}>
          <CartesianGrid vertical={false} stroke="#e6e9ef" />
          <XAxis dataKey="month" fontSize={12} />
          <YAxis allowDecimals={false} fontSize={12} />
          <Tooltip />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="approved" name="Approved" stackId="m" fill={COLOR.taken} radius={[0, 0, 0, 0]} />
          <Bar dataKey="pending" name="Pending" stackId="m" fill={COLOR.pending} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}