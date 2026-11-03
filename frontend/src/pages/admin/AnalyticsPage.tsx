import { useState } from "react";
import { Link } from "react-router-dom";
import { analyticsApi, feedbackApi } from "../../api";
import { DepartmentChart, DistributionChart, TrendChart } from "../../components/charts";
import { ErrorState, PageHeader, Pagination, Select, Skeleton, StatCard } from "../../components/ui";
import { useAsync } from "../../utils/useAsync";
import { formatDate } from "../../utils/format";
import WorkloadPage from "../employee/WorkloadPage";

const pct = (v: number | null) => (v === null ? "-" : `${v}%`);

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [fbPage, setFbPage] = useState(1);
  const summary = useAsync(() => analyticsApi.summary(), []);
  const trends = useAsync(() => analyticsApi.trends(days), [days]);
  const dept = useAsync(() => analyticsApi.byDepartment(), []);
  const feedback = useAsync(() => feedbackApi.list(fbPage), [fbPage]);
  const s = summary.data;

  return (
    <>
      <PageHeader title="Analytics" subtitle="Performance of your complaint handling." />
      {summary.error && <ErrorState message={summary.error} onRetry={summary.retry} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : s && (
          <>
            <StatCard label="Resolution rate" value={pct(s.resolutionRate)} tone="good" />
            <StatCard label="SLA compliance" value={pct(s.slaCompliance)} />
            <StatCard label="Avg resolution" value={s.avgResolutionHours === null ? "-" : `${s.avgResolutionHours}h`} />
            <StatCard label="Avg first response" value={s.avgFirstResponseHours === null ? "-" : `${s.avgFirstResponseHours}h`} />
          </>
        )}
      </div>

      <div className="card mt-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Created vs resolved</h2>
          <Select aria-label="Period" className="w-40" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </Select>
        </div>
        {trends.loading ? <Skeleton className="h-64" /> : trends.error ? <ErrorState message={trends.error} onRetry={trends.retry} /> : <TrendChart data={trends.data ?? []} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-5"><h2 className="mb-3 text-sm font-semibold">By priority</h2>{summary.loading ? <Skeleton className="h-64" /> : <DistributionChart counts={s?.byPriority ?? {}} />}</div>
        <div className="card p-5"><h2 className="mb-3 text-sm font-semibold">By category</h2>{summary.loading ? <Skeleton className="h-64" /> : <DistributionChart counts={s?.byCategory ?? {}} />}</div>
        <div className="card p-5"><h2 className="mb-3 text-sm font-semibold">By status</h2>{summary.loading ? <Skeleton className="h-64" /> : <DistributionChart counts={s?.byStatus ?? {}} colorByKey />}</div>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">By department</h2>
        {dept.loading ? <Skeleton className="h-64" /> : dept.error ? <ErrorState message={dept.error} onRetry={dept.retry} /> : (
          <>
            <DepartmentChart data={dept.data ?? []} />
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50"><tr><th className="th">Department</th><th className="th">Total</th><th className="th">Resolved</th><th className="th">Escalated</th><th className="th">Avg resolution</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(dept.data ?? []).map((d) => (
                    <tr key={d.departmentId ?? "none"}><td className="td font-medium">{d.name}</td><td className="td">{d.total}</td><td className="td">{d.resolved}</td><td className="td">{d.escalated}</td><td className="td">{d.avgResolutionHours === null ? "-" : `${d.avgResolutionHours}h`}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="mt-6"><WorkloadPage /></div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3"><h2 className="text-sm font-semibold">Customer feedback {s?.avgRating != null && <span className="font-normal text-slate-500">· average {s.avgRating}/5</span>}</h2></div>
        {feedback.loading ? <div className="p-5"><Skeleton className="h-24" /></div> : feedback.error ? <div className="p-4"><ErrorState message={feedback.error} onRetry={feedback.retry} /></div> :
          (feedback.data?.items.length ?? 0) === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">No feedback yet.</p> : (
            <>
              <ul className="divide-y divide-slate-100">
                {feedback.data!.items.map((f) => (
                  <li key={f.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-amber-500" aria-label={`${f.rating} out of 5`}>{"★".repeat(f.rating)}<span className="text-slate-300">{"★".repeat(5 - f.rating)}</span></span>
                      <span className="text-xs text-slate-500">{f.customer?.name} · {formatDate(f.createdAt)}</span>
                    </div>
                    {f.comment && <p className="mt-1 text-sm text-slate-700">{f.comment}</p>}
                    {f.complaint && <Link className="mt-1 inline-block text-xs text-brand-600 hover:underline" to={`/app/complaints/${f.complaint.id}`}>{f.complaint.ticketNo}: {f.complaint.title}</Link>}
                  </li>
                ))}
              </ul>
              <Pagination page={feedback.data!.meta.page} totalPages={feedback.data!.meta.totalPages} total={feedback.data!.meta.total} onPage={setFbPage} />
            </>
          )}
      </div>
    </>
  );
}
