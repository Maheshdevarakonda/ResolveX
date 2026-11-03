import { Link } from "react-router-dom";
import { complaintApi } from "../../api";
import { Button, EmptyState, ErrorState, EscalatedBadge, PageHeader, PageLoader, PriorityBadge, StatCard, StatusBadge } from "../../components/ui";
import { SlaTimer } from "../../components/SlaTimer";
import { useAuth } from "../../context/AuthContext";
import { useLiveRefresh } from "../../context/RealtimeContext";
import { formatDate } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const stats = useAsync(() => complaintApi.stats(), []);
  const recent = useAsync(() => complaintApi.list({ limit: 5, sort: "newest" }), []);
  useLiveRefresh(() => { stats.reload(); recent.reload(); });

  const s = stats.data?.byStatus;
  const inProgress = s ? s.ASSIGNED + s.IN_PROGRESS + s.REOPENED : 0;

  return (
    <>
      <PageHeader title={`Hello, ${user!.name.split(" ")[0]}`} subtitle="Here is where your complaints stand."
        actions={<Link to="/app/complaints/new"><Button>New complaint</Button></Link>} />

      {stats.error ? <ErrorState message={stats.error} onRetry={stats.retry} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total submitted" value={stats.loading ? "-" : stats.data!.total} />
          <StatCard label="Waiting for a response" value={stats.loading ? "-" : s!.OPEN} tone={s && s.OPEN > 0 ? "warn" : "default"} />
          <StatCard label="Being worked on" value={stats.loading ? "-" : inProgress} />
          <StatCard label="Resolved" value={stats.loading ? "-" : s!.RESOLVED + s!.CLOSED} tone="good" hint={s && s.RESOLVED > 0 ? `${s.RESOLVED} awaiting your confirmation` : undefined} />
        </div>
      )}

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold">Recent complaints</h2>
          <Link className="text-sm text-brand-600 hover:underline" to="/app/complaints">View all</Link>
        </div>
        {recent.loading && <PageLoader />}
        {!recent.loading && recent.error && <div className="p-4"><ErrorState message={recent.error} onRetry={recent.retry} /></div>}
        {!recent.loading && !recent.error && recent.data?.items.length === 0 && (
          <EmptyState title="No complaints yet" message="If something goes wrong, submit a complaint and we will track it to resolution."
            action={<Link to="/app/complaints/new"><Button>Submit a complaint</Button></Link>} />
        )}
        <ul className="divide-y divide-slate-100">
          {recent.data?.items.map((c) => (
            <li key={c.id}>
              <Link to={`/app/complaints/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{c.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{c.ticketNo} · {formatDate(c.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <SlaTimer complaint={c} /><PriorityBadge priority={c.priority} /><StatusBadge status={c.status} />{c.isEscalated && <EscalatedBadge />}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
