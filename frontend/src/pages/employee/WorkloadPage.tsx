import { analyticsApi } from "../../api";
import { EmptyState, ErrorState, PageHeader, PageLoader } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useLiveRefresh } from "../../context/RealtimeContext";
import { useAsync } from "../../utils/useAsync";

export default function WorkloadPage() {
  const { user } = useAuth();
  const { data, loading, error, reload, retry } = useAsync(() => analyticsApi.workload(), []);
  useLiveRefresh(reload);
  const isAdmin = user!.role === "ADMIN";

  return (
    <>
      <PageHeader title="Workload" subtitle={isAdmin ? "Open work per employee." : "Your open work and recent output."} />
      <div className="card overflow-hidden">
        {loading && <PageLoader />}
        {!loading && error && <div className="p-4"><ErrorState message={error} onRetry={retry} /></div>}
        {!loading && !error && data && data.length === 0 && <EmptyState title="No employees yet" message="Add employees from the Employees page." />}
        {!loading && !error && data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr><th className="th">Employee</th><th className="th">Assigned</th><th className="th">In progress</th><th className="th">Open total</th><th className="th">Due in 24h</th><th className="th">Escalated</th><th className="th">Resolved (7 days)</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((w) => (
                  <tr key={w.employeeId}>
                    <td className="td"><p className="font-medium text-slate-900">{w.name}</p><p className="text-xs text-slate-500">{w.email}</p></td>
                    <td className="td">{w.assigned}</td><td className="td">{w.inProgress}</td>
                    <td className="td font-semibold">{w.open}</td>
                    <td className="td">{w.dueSoon > 0 ? <span className="font-medium text-amber-600">{w.dueSoon}</span> : 0}</td>
                    <td className="td">{w.escalated > 0 ? <span className="font-medium text-red-600">{w.escalated}</span> : 0}</td>
                    <td className="td">{w.resolvedLast7Days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
