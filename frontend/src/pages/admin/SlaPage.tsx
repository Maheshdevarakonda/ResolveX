import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { complaintApi, slaApi } from "../../api";
import { getErrorMessage } from "../../api/client";
import { SlaTimer } from "../../components/SlaTimer";
import { Button, EmptyState, ErrorState, EscalatedBadge, Input, PageHeader, PageLoader, PriorityBadge, StatusBadge } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import type { SlaPolicy } from "../../types";
import { humanize, minutesToText } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";

export default function SlaPage() {
  const toast = useToast();
  const policies = useAsync(() => slaApi.list(), []);
  const escalated = useAsync(() => complaintApi.list({ isEscalated: true, limit: 10, sort: "due" }), []);
  const [draft, setDraft] = useState<SlaPolicy[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (policies.data) setDraft(policies.data); }, [policies.data]);

  const change = (priority: string, key: "responseMinutes" | "resolutionMinutes", value: string) =>
    setDraft((d) => d.map((p) => (p.priority === priority ? { ...p, [key]: Number(value) } : p)));

  const invalid = draft.some((p) => !Number.isInteger(p.responseMinutes) || !Number.isInteger(p.resolutionMinutes) || p.responseMinutes < 5 || p.resolutionMinutes < 5 ||
    p.responseMinutes > 43200 || p.resolutionMinutes > 43200 || p.resolutionMinutes < p.responseMinutes);

  const save = async () => {
    setBusy(true);
    try { policies.setData(await slaApi.save(draft)); toast.success("SLA policies saved. They apply to new complaints."); }
    catch (err) { toast.error(getErrorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="SLA policies" subtitle="How quickly each priority must get a first reply and a resolution. A complaint that misses its resolution deadline is escalated automatically." />
      <div className="card overflow-hidden">
        {policies.loading && <PageLoader />}
        {!policies.loading && policies.error && <div className="p-4"><ErrorState message={policies.error} onRetry={policies.retry} /></div>}
        {!policies.loading && !policies.error && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50"><tr><th className="th">Priority</th><th className="th">First response (minutes)</th><th className="th">Resolution (minutes)</th><th className="th">In plain words</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {draft.map((p) => (
                    <tr key={p.priority}>
                      <td className="td"><PriorityBadge priority={p.priority} /></td>
                      <td className="td"><Input aria-label={`${humanize(p.priority)} first response minutes`} type="number" min={5} max={43200} className="w-32" value={p.responseMinutes} onChange={(e) => change(p.priority, "responseMinutes", e.target.value)} /></td>
                      <td className="td"><Input aria-label={`${humanize(p.priority)} resolution minutes`} type="number" min={5} max={43200} className="w-32" value={p.resolutionMinutes} onChange={(e) => change(p.priority, "resolutionMinutes", e.target.value)} /></td>
                      <td className="td text-xs text-slate-500">Reply within {minutesToText(p.responseMinutes)}, resolve within {minutesToText(p.resolutionMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
              <p className="text-xs text-slate-500">5 minutes to 30 days. Resolution time must be at least the response time.{invalid && <span className="ml-2 font-medium text-red-600">Please fix the highlighted values.</span>}</p>
              <Button loading={busy} disabled={invalid} onClick={save}>Save policies</Button>
            </div>
          </>
        )}
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3"><h2 className="text-sm font-semibold">Currently escalated</h2></div>
        {escalated.loading && <PageLoader />}
        {!escalated.loading && escalated.error && <div className="p-4"><ErrorState message={escalated.error} onRetry={escalated.retry} /></div>}
        {!escalated.loading && !escalated.error && escalated.data?.items.length === 0 && <EmptyState title="No escalated complaints" />}
        <ul className="divide-y divide-slate-100">
          {escalated.data?.items.map((c) => (
            <li key={c.id}>
              <Link to={`/app/complaints/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                <div><p className="text-sm font-medium text-slate-900">{c.title}</p><p className="text-xs text-slate-500">{c.ticketNo} · {c.assignedTo?.name ?? "Unassigned"}</p></div>
                <div className="flex items-center gap-2"><SlaTimer complaint={c} /><StatusBadge status={c.status} /><EscalatedBadge /></div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
