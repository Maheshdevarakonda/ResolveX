import { useState } from "react";
import { Link } from "react-router-dom";
import { notificationApi } from "../../api";
import { getErrorMessage } from "../../api/client";
import { Button, EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from "../../components/ui";
import { useLiveRefresh, useRealtime } from "../../context/RealtimeContext";
import { useToast } from "../../context/ToastContext";
import { cn, formatDate, humanize } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { setUnread } = useRealtime();
  const toast = useToast();
  const { data, loading, error, reload, retry } = useAsync(() => notificationApi.list({ page, limit: 15 }), [page]);
  useLiveRefresh(reload);

  const markAll = async () => {
    try { await notificationApi.readAll(); setUnread(0); reload(); } catch (err) { toast.error(getErrorMessage(err)); }
  };
  const open = async (id: string, isRead: boolean) => {
    if (isRead) return;
    try { await notificationApi.read(id); setUnread((n) => Math.max(0, n - 1)); reload(); } catch { /* the page still navigates */ }
  };

  return (
    <>
      <PageHeader title="Notifications" subtitle="Updates about your complaints." actions={<Button variant="secondary" onClick={markAll}>Mark all as read</Button>} />
      <div className="card overflow-hidden">
        {loading && <PageLoader />}
        {!loading && error && <div className="p-4"><ErrorState message={error} onRetry={retry} /></div>}
        {!loading && !error && data && data.items.length === 0 && <EmptyState title="You're all caught up" message="New activity on your complaints will show up here." />}
        {!loading && !error && data && data.items.length > 0 && (
          <>
            <ul className="divide-y divide-slate-100">
              {data.items.map((n) => {
                const body = (
                  <div className={cn("flex items-start gap-3 px-5 py-4", !n.isRead && "bg-brand-50/50")}>
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-brand-600")} aria-label={n.isRead ? "Read" : "Unread"} />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{n.message}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{humanize(n.type)} · {formatDate(n.createdAt)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.complaintId ? <Link to={`/app/complaints/${n.complaintId}`} onClick={() => open(n.id, n.isRead)} className="block hover:bg-slate-50">{body}</Link>
                      : <button className="block w-full text-left hover:bg-slate-50" onClick={() => open(n.id, n.isRead)}>{body}</button>}
                  </li>
                );
              })}
            </ul>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}
