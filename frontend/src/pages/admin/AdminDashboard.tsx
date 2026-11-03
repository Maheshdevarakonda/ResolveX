import { Link } from "react-router-dom";
import { analyticsApi, complaintApi } from "../../api";
import { DistributionChart, TrendChart } from "../../components/charts";
import { EmptyState, ErrorState, EscalatedBadge, PageHeader, PageLoader, PriorityBadge, Skeleton, StatCard, StatusBadge } from "../../components/ui";
import { useLiveRefresh } from "../../context/RealtimeContext";
import { formatDate } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";

const pct = (v: number | null) => (v === null ? "-" : `${v}%`);

export default function AdminDashboard() {
  const summary = useAsync(() => analyticsApi.summary(), []);
  const trends = useAsync(() => analyticsApi.trends(30), []);
  const escalated = useAsync(() => complaintApi.list({ isEscalated: true, limit: 5, sort: "due" }), []);
  useLiveRefresh(() => { summary.reload(); trends.reload(); escalated.reload(); });
  const s = summary.data;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="How your organization is handling complaints." />
      {summary.error ? <ErrorState message={summary.error} onRetry={summary.retry} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summary.loading ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />) : s && (
              <>
                <StatCard label="Total complaints" value={s.total} />
                <StatCard label="Pending" value={s.pending} tone={s.pending > 0 ? "warn" : "default"} />
                <StatCard label="Escalated" value={s.escalated} tone={s.escalated > 0 ? "bad" : "default"} hint="Active complaints past their deadline" />
                <StatCard label="Resolution rate" value={pct(s.resolutionRate)} tone="good" hint={`${s.resolved} resolved or closed`} />
                <StatCard label="Avg resolution time" value={s.avgResolutionHours === null ? "-" : `${s.avgResolutionHours}h`} />
                <StatCard label="SLA compliance" value={pct(s.slaCompliance)} hint="Resolved before their deadline" />
                <StatCard label="First-response compliance" value={pct(s.firstResponseCompliance)} />
                <StatCard label="Customer rating" value={s.avgRating === null ? "-" : `${s.avgRating}/5`} hint={`${s.ratingCount} rating${s.ratingCount === 1 ? "" : "s"}`} />
              </>
            )}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold">Last 30 days</h2>
              {trends.loading ? <Skeleton className="h-64" /> : trends.error ? <ErrorState message={trends.error} onRetry={trends.retry} /> : <TrendChart data={trends.data ?? []} />}
            </div>
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-semibold">By status</h2>
              {summary.loading ? <Skeleton className="h-64" /> : <DistributionChart counts={s?.byStatus ?? {}} colorByKey />}
            </div>
          </div>
        </>
      )}

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold">Escalated complaints</h2>
          <Link className="text-sm text-brand-600 hover:underline" to="/app/complaints?escalated=true">View all</Link>
        </div>
        {escalated.loading && <PageLoader />}
        {!escalated.loading && escalated.error && <div className="p-4"><ErrorState message={escalated.error} onRetry={escalated.retry} /></div>}
        {!escalated.loading && !escalated.error && escalated.data?.items.length === 0 && <EmptyState title="Nothing escalated" message="Complaints that miss their deadline appear here automatically." />}
        <ul className="divide-y divide-slate-100">
          {escalated.data?.items.map((c) => (
            <li key={c.id}>
              <Link to={`/app/complaints/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{c.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{c.ticketNo} · {c.assignedTo?.name ?? "Unassigned"} · escalated {formatDate(c.escalatedAt)}</p>
                </div>
                <div className="flex items-center gap-2"><PriorityBadge priority={c.priority} /><StatusBadge status={c.status} /><EscalatedBadge /></div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
