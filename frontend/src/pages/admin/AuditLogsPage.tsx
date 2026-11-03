import { useState } from "react";
import { Link } from "react-router-dom";
import { auditApi } from "../../api";
import { EmptyState, ErrorState, Input, PageHeader, PageLoader, Pagination, Select } from "../../components/ui";
import { formatDate, humanize } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";

const ACTIONS = [
  "COMPLAINT_CREATED", "COMPLAINT_ASSIGNED", "COMPLAINT_ACCEPTED", "COMPLAINT_STATUS_CHANGED", "COMPLAINT_CLOSED", "COMPLAINT_REOPENED", "COMPLAINT_ESCALATED",
  "COMMENT_ADDED", "ATTACHMENT_ADDED", "FEEDBACK_SUBMITTED", "USER_CREATED", "USER_UPDATED", "USER_DEACTIVATED", "USER_ACTIVATED",
  "DEPARTMENT_CREATED", "DEPARTMENT_UPDATED", "DEPARTMENT_DELETED", "SLA_POLICY_UPDATED", "ORGANIZATION_UPDATED", "PASSWORD_RESET",
];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, loading, error, retry } = useAsync(
    () => auditApi.list({
      page, limit: 20, action: action || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    }),
    [page, action, from, to]
  );

  return (
    <>
      <PageHeader title="Audit logs" subtitle="Who did what, and when. Entries cannot be edited." />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <Select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>{ACTIONS.map((a) => <option key={a} value={a}>{humanize(a)}</option>)}
        </Select>
        <Input aria-label="From date" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input aria-label="To date" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>

      <div className="card overflow-hidden">
        {loading && <PageLoader />}
        {!loading && error && <div className="p-4"><ErrorState message={error} onRetry={retry} /></div>}
        {!loading && !error && data?.items.length === 0 && <EmptyState title="No audit entries" message="Try a different filter." />}
        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50"><tr><th className="th">When</th><th className="th">Who</th><th className="th">Action</th><th className="th">Complaint</th><th className="th">Details</th></tr></thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {data.items.map((l) => (
                    <tr key={l.id}>
                      <td className="td whitespace-nowrap text-xs">{formatDate(l.createdAt)}</td>
                      <td className="td whitespace-nowrap">{l.actorName}<span className="ml-1 text-xs text-slate-500">({humanize(l.actorRole)})</span></td>
                      <td className="td whitespace-nowrap font-medium">{humanize(l.action)}</td>
                      <td className="td whitespace-nowrap">{l.complaint ? <Link className="text-brand-600 hover:underline" to={`/app/complaints/${l.complaint.id}`}>{l.complaint.ticketNo}</Link> : "-"}</td>
                      <td className="td">
                        {l.changes ? (
                          <details><summary className="cursor-pointer text-xs text-brand-600">Show changes</summary>
                            <pre className="mt-1 max-w-md overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">{JSON.stringify(l.changes, null, 2)}</pre>
                          </details>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}
