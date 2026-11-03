import { Link } from "react-router-dom";
import { analyticsApi, complaintApi } from "../../api";
import { EmptyState, ErrorState, EscalatedBadge, PageHeader, PageLoader, PriorityBadge, StatCard, StatusBadge } from "../../components/ui";
import { SlaTimer } from "../../components/SlaTimer";
import { useAuth } from "../../context/AuthContext";
import { useLiveRefresh } from "../../context/RealtimeContext";
import type { Complaint } from "../../types";
import { useAsync } from "../../utils/useAsync";

function List({ title, link, items, loading, error, retry, empty }: {
  title: string; link: string; items?: Complaint[]; loading: boolean; error: string; retry: () => void; empty: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link className="text-sm text-brand-600 hover:underline" to={link}>View all</Link>
      </div>
      {loading && <PageLoader />}
      {!loading && error && <div className="p-4"><ErrorState message={error} onRetry={retry} /></div>}
      {!loading && !error && items?.length === 0 && <EmptyState title={empty} />}
      <ul className="divide-y divide-slate-100">
        {items?.map((c) => (
          <li key={c.id}>
            <Link to={`/app/complaints/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{c.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{c.ticketNo} · {c.customer?.name}</p>
              </div>
              <div className="flex items-center gap-2"><SlaTimer complaint={c} /><PriorityBadge priority={c.priority} /><StatusBadge status={c.status} />{c.isEscalated && <EscalatedBadge />}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const workload = useAsync(() => analyticsApi.workload(), []);
  const queue = useAsync(() => complaintApi.list({ limit: 6, sort: "due", assignedTo: user!.id }), [user!.id]);
  const pool = useAsync(() => complaintApi.list({ limit: 6, status: "OPEN", sort: "oldest" }), []);
  useLiveRefresh(() => { workload.reload(); queue.reload(); pool.reload(); });

  const me = workload.data?.[0];
  const dash = (v?: number) => (workload.loading ? "-" : v ?? 0);

  return (
    <>
      <PageHeader title={`Hello, ${user!.name.split(" ")[0]}`} subtitle="Your queue, ordered by what is due first." />
      {workload.error ? <ErrorState message={workload.error} onRetry={workload.retry} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Open assigned" value={dash(me?.open)} />
          <StatCard label="Due in 24h" value={dash(me?.dueSoon)} tone={me && me.dueSoon > 0 ? "warn" : "default"} />
          <StatCard label="Escalated" value={dash(me?.escalated)} tone={me && me.escalated > 0 ? "bad" : "default"} />
          <StatCard label="In progress" value={dash(me?.inProgress)} />
          <StatCard label="Resolved (7 days)" value={dash(me?.resolvedLast7Days)} tone="good" />
        </div>
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <List title="My queue" link="/app/complaints" items={queue.data?.items.filter((c) => !["RESOLVED", "CLOSED"].includes(c.status))} loading={queue.loading} error={queue.error} retry={queue.retry} empty="Nothing assigned to you" />
        <List title="Unassigned: available to accept" link="/app/complaints?status=OPEN" items={pool.data?.items} loading={pool.loading} error={pool.error} retry={pool.retry} empty="No unassigned complaints" />
      </div>
    </>
  );
}
