import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DepartmentStat, TrendPoint } from "../types";
import { formatDay, humanize } from "../utils/format";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#0ea5e9", "#a855f7"];
const STATUS_COLORS: Record<string, string> = {
  OPEN: "#3b82f6", ASSIGNED: "#8b5cf6", IN_PROGRESS: "#f59e0b", RESOLVED: "#10b981", CLOSED: "#94a3b8", REOPENED: "#f97316",
};

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip labelFormatter={(l) => formatDay(String(l))} />
        <Legend />
        <Line type="monotone" dataKey="created" name="Created" stroke="#6366f1" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DistributionChart({ counts, colorByKey }: { counts: Record<string, number>; colorByKey?: boolean }) {
  const data = Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name: humanize(name), key: name, value }));
  if (data.length === 0) return <p className="py-10 text-center text-sm text-slate-500">No data yet</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((d, i) => <Cell key={d.key} fill={colorByKey ? STATUS_COLORS[d.key] ?? COLORS[i % COLORS.length] : COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DepartmentChart({ data }: { data: DepartmentStat[] }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-slate-500">No data yet</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="total" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="escalated" name="Escalated" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
