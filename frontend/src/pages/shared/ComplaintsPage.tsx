import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { complaintApi, ComplaintFilters } from "../../api";
import { Button, EmptyState, ErrorState, EscalatedBadge, Input, PageHeader, PageLoader, Pagination, PriorityBadge, Select, StatusBadge } from "../../components/ui";
import { SlaTimer } from "../../components/SlaTimer";
import { useAuth } from "../../context/AuthContext";
import { useLiveRefresh } from "../../context/RealtimeContext";
import { CATEGORIES, Category, PRIORITIES, Priority, STATUSES, Status } from "../../types";
import { formatDate, humanize } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";

const TITLES = { CUSTOMER: "My complaints", EMPLOYEE: "Assigned complaints", ADMIN: "All complaints" } as const;
const SUBTITLES = {
  CUSTOMER: "Everything you have submitted and where it stands.",
  EMPLOYEE: "Your assigned work, plus unassigned complaints you can accept.",
  ADMIN: "Every complaint in your organization.",
} as const;

export default function ComplaintsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const filters: ComplaintFilters = {
    page: Number(params.get("page") ?? 1),
    limit: 15,
    status: (params.get("status") ?? "") as Status | "",
    priority: (params.get("priority") ?? "") as Priority | "",
    category: (params.get("category") ?? "") as Category | "",
    q: params.get("q") ?? "",
    sort: (params.get("sort") as ComplaintFilters["sort"]) ?? "newest",
    isEscalated: params.get("escalated") === "true" ? true : undefined,
  };

  const { data, loading, error, reload, retry } = useAsync(() => complaintApi.list(filters), [params.toString()]);
  useLiveRefresh(reload);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  const submitSearch = (e: FormEvent) => { e.preventDefault(); setParam("q", search.trim()); };
  const isStaff = user?.role !== "CUSTOMER";
  const hasFilters = ["status", "priority", "category", "q", "escalated"].some((k) => params.get(k));

  return (
    <>
      <PageHeader
        title={TITLES[user!.role]}
        subtitle={SUBTITLES[user!.role]}
        actions={user!.role === "CUSTOMER" ? <Link to="/app/complaints/new"><Button>New complaint</Button></Link> : undefined}
      />

      <div className="card mb-4 p-4">
        <form onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <Input aria-label="Search" placeholder="Search by title or ticket number" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Status" value={filters.status} onChange={(e) => setParam("status", e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </Select>
          <Select aria-label="Priority" value={filters.priority} onChange={(e) => setParam("priority", e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
          </Select>
          <Select aria-label="Category" value={filters.category} onChange={(e) => setParam("category", e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </Select>
          <Select aria-label="Sort" value={filters.sort} onChange={(e) => setParam("sort", e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            {isStaff && <option value="due">Deadline soonest</option>}
          </Select>
        </form>
        {isStaff && (
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={params.get("escalated") === "true"} onChange={(e) => setParam("escalated", e.target.checked ? "true" : "")} />
            Escalated only
          </label>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading && <PageLoader />}
        {!loading && error && <div className="p-4"><ErrorState message={error} onRetry={retry} /></div>}
        {!loading && !error && data && data.items.length === 0 && (
          <EmptyState
            title={hasFilters ? "No complaints match these filters" : "No complaints yet"}
            message={hasFilters ? "Try removing a filter." : user!.role === "CUSTOMER" ? "When you submit a complaint it will appear here." : "New complaints will appear here."}
            action={hasFilters ? <Button variant="secondary" onClick={() => { setSearch(""); setParams(new URLSearchParams()); }}>Clear filters</Button>
              : user!.role === "CUSTOMER" ? <Link to="/app/complaints/new"><Button>Submit a complaint</Button></Link> : undefined}
          />
        )}
        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Ticket</th><th className="th">Complaint</th><th className="th">Status</th><th className="th">Priority</th>
                    {isStaff && <th className="th">Assigned to</th>}<th className="th">Deadline</th><th className="th">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="td whitespace-nowrap font-mono text-xs"><Link className="text-brand-600 hover:underline" to={`/app/complaints/${c.id}`}>{c.ticketNo}</Link></td>
                      <td className="td max-w-xs">
                        <Link to={`/app/complaints/${c.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-700">{c.title}</Link>
                        <span className="text-xs text-slate-500">{humanize(c.category)}{isStaff && c.customer ? ` · ${c.customer.name}` : ""}</span>
                      </td>
                      <td className="td"><div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={c.status} />{c.isEscalated && <EscalatedBadge />}</div></td>
                      <td className="td"><PriorityBadge priority={c.priority} /></td>
                      {isStaff && <td className="td whitespace-nowrap">{c.assignedTo?.name ?? <span className="text-slate-400">Unassigned</span>}</td>}
                      <td className="td whitespace-nowrap"><SlaTimer complaint={c} /></td>
                      <td className="td whitespace-nowrap text-xs text-slate-500">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={(p) => setParam("page", String(p))} />
          </>
        )}
      </div>
    </>
  );
}
