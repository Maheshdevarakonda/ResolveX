import { FormEvent, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { complaintApi, userApi } from "../../api";
import { getErrorMessage } from "../../api/client";
import { Button, ConfirmDialog, EscalatedBadge, ErrorState, Field, Modal, PageLoader, PriorityBadge, Select, StatusBadge, Textarea } from "../../components/ui";
import { SlaTimer } from "../../components/SlaTimer";
import { useAuth } from "../../context/AuthContext";
import { useLiveRefresh } from "../../context/RealtimeContext";
import { useToast } from "../../context/ToastContext";
import type { Complaint, Priority } from "../../types";
import { PRIORITIES } from "../../types";
import { cn, formatDate, humanize } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";

export default function ComplaintDetailPage() {
  const { id = "" } = useParams();
  const { user, isDemoMode } = useAuth();
  const toast = useToast();
  const role = user!.role;

  const complaintQ = useAsync(() => complaintApi.get(id), [id]);
  const commentsQ = useAsync(() => complaintApi.comments(id), [id]);
  const feedbackQ = useAsync(() => (role === "CUSTOMER" ? complaintApi.feedback(id) : Promise.resolve(null)), [id]);
  const refreshAll = () => { complaintQ.reload(); commentsQ.reload(); feedbackQ.reload(); };
  useLiveRefresh(refreshAll, id);

  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | "assign" | "resolve" | "reopen" | "close" | "priority">(null);
  const [employeeId, setEmployeeId] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<Priority>("MEDIUM");
  const [note, setNote] = useState("");
  const [commentText, setCommentText] = useState("");
  const [internal, setInternal] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const employeesQ = useAsync(
    () => (role === "ADMIN" ? userApi.list({ role: "EMPLOYEE", isActive: true, limit: 100 }) : Promise.resolve(null)),
    [role]
  );

  const c = complaintQ.data;
  if (complaintQ.loading) return <PageLoader />;
  if (complaintQ.error || !c) {
    return (
      <div className="space-y-4">
        <ErrorState message={complaintQ.error || "Complaint not found"} onRetry={complaintQ.retry} />
        <Link className="text-sm text-brand-600 hover:underline" to="/app/complaints">Back to complaints</Link>
      </div>
    );
  }

  const mine = c.assignedTo?.id === user!.id;
  const activeStatus = ["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED"].includes(c.status);
  const canAssign = role === "ADMIN" && activeStatus;
  const canAccept = role === "EMPLOYEE" && c.status === "OPEN" && !c.assignedTo;
  const canWork = role === "ADMIN" || (role === "EMPLOYEE" && mine);
  const canStart = canWork && ["ASSIGNED", "REOPENED"].includes(c.status);
  const canResolve = canWork && c.status === "IN_PROGRESS";
  const canChangePriority = canWork && activeStatus;
  const canClose = (role === "ADMIN" || role === "CUSTOMER") && c.status === "RESOLVED";
  const canReopen = role === "CUSTOMER" && c.status === "RESOLVED";
  const canComment = c.status !== "CLOSED" && (role !== "EMPLOYEE" || mine);
  const canUpload = canComment && c.attachments.length < 5;

  const act = async (fn: () => Promise<Complaint>, success: string) => {
    setBusy(true);
    try {
      complaintQ.setData(await fn());
      toast.success(success);
      commentsQ.reload();
      setModal(null); setNote("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setBusy(true);
    try {
      await complaintApi.addComment(c.id, commentText.trim(), internal);
      setCommentText(""); setInternal(false);
      commentsQ.reload(); complaintQ.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await act(() => complaintApi.upload(c.id, Array.from(files)), "Files uploaded");
    if (fileInput.current) fileInput.current.value = "";
  };

  const submitFeedback = async () => {
    setBusy(true);
    try {
      await complaintApi.sendFeedback(c.id, rating, feedbackText.trim() || undefined);
      toast.success("Thank you for your feedback");
      feedbackQ.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/app/complaints" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800">&larr; Back to complaints</Link>

      {isDemoMode && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <span className="text-sm">💡</span>
          <div>
            <span className="font-semibold uppercase tracking-wider">Recruiter Workflow Guide: </span>
            {role === "CUSTOMER" && "You are viewing this ticket as Customer. You can check the live SLA timer, view conversation history, or switch to Employee View in the top bar to accept and resolve this complaint."}
            {role === "EMPLOYEE" && "As Support Staff, you can claim unassigned tickets, click 'Change priority' (dynamically recalculates the SLA deadline), mark 'Start work', or 'Resolve' with a customer resolution note."}
            {role === "ADMIN" && "As Administrator, you have full supervisory privileges: reassign tickets across employees, override priority, inspect full audit history, and monitor SLA compliance."}
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-500">{c.ticketNo}</p>
          <h1 className="mt-1 text-2xl font-semibold">{c.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} /><PriorityBadge priority={c.priority} />
            {c.isEscalated && <EscalatedBadge />}
            <span className="text-xs text-slate-500">{humanize(c.category)}</span>
            {c.reopenCount > 0 && <span className="text-xs text-orange-600">Reopened {c.reopenCount}x</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAccept && <Button loading={busy} onClick={() => act(() => complaintApi.accept(c.id), "Complaint accepted")}>Accept</Button>}
          {canAssign && <Button variant="secondary" onClick={() => { setEmployeeId(c.assignedTo?.id ?? ""); setModal("assign"); }}>{c.assignedTo ? "Reassign" : "Assign"}</Button>}
          {canStart && <Button loading={busy} onClick={() => act(() => complaintApi.setStatus(c.id, "IN_PROGRESS"), "Marked in progress")}>Start work</Button>}
          {canChangePriority && <Button variant="secondary" onClick={() => { setSelectedPriority(c.priority); setModal("priority"); }}>Change priority</Button>}
          {canResolve && <Button onClick={() => setModal("resolve")}>Resolve</Button>}
          {canClose && <Button variant="secondary" onClick={() => setModal("close")}>Close</Button>}
          {canReopen && <Button variant="secondary" onClick={() => setModal("reopen")}>Reopen</Button>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{c.description}</p>

            {c.resolutionNote && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Resolution</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{c.resolutionNote}</p>
              </div>
            )}

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Attachments</h3>
                {canUpload && (
                  <>
                    <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" aria-label="Upload files" onChange={(e) => onFiles(e.target.files)} />
                    <Button size="sm" variant="secondary" loading={busy} onClick={() => fileInput.current?.click()}>Add files</Button>
                  </>
                )}
              </div>
              {c.attachments.length === 0 ? <p className="mt-2 text-sm text-slate-500">No attachments.</p> : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {c.attachments.map((a) => (
                    <li key={a.url} className="flex items-center justify-between px-3 py-2 text-sm">
                      <a className="truncate text-brand-600 hover:underline" href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>
                      <span className="ml-3 shrink-0 text-xs text-slate-500">{(a.size / 1024).toFixed(0)} KB</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Conversation</h2>
            <div className="mt-4 space-y-4">
              {commentsQ.loading && <PageLoader label="Loading comments" />}
              {!commentsQ.loading && (commentsQ.data ?? []).length === 0 && <p className="text-sm text-slate-500">No messages yet.</p>}
              {(commentsQ.data ?? []).map((m) => (
                <div key={m.id} className={cn("rounded-lg border p-3", m.isInternal ? "border-amber-200 bg-amber-50" : m.author?.id === user!.id ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-white")}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-800">{m.author?.name ?? "Unknown"} <span className="font-normal text-slate-500">({humanize(m.author?.role ?? "")})</span></span>
                    <span>{formatDate(m.createdAt)}</span>
                  </div>
                  {m.isInternal && <p className="mt-1 text-xs font-semibold uppercase text-amber-700">Internal note (hidden from the customer)</p>}
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{m.body}</p>
                </div>
              ))}
            </div>

            {canComment ? (
              <form onSubmit={submitComment} className="mt-5 space-y-3">
                <Textarea aria-label="Write a message" placeholder="Write a message..." maxLength={2000} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {role !== "CUSTOMER" ? (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (staff only)
                    </label>
                  ) : <span />}
                  <Button type="submit" loading={busy} disabled={!commentText.trim()}>Send</Button>
                </div>
              </form>
            ) : (
              <p className="mt-5 text-sm text-slate-500">{c.status === "CLOSED" ? "This complaint is closed." : "Accept this complaint to reply."}</p>
            )}
          </section>

          {role === "CUSTOMER" && ["RESOLVED", "CLOSED"].includes(c.status) && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900">Your feedback</h2>
              {feedbackQ.data ? (
                <p className="mt-2 text-sm text-slate-700">You rated this {feedbackQ.data.rating}/5{feedbackQ.data.comment ? `: "${feedbackQ.data.comment}"` : "."}</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div role="radiogroup" aria-label="Rating" className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}
                        className={cn("h-10 w-10 rounded-lg border text-lg", n <= rating ? "border-amber-400 bg-amber-50 text-amber-500" : "border-slate-300 text-slate-300 hover:border-slate-400")}>
                        ★
                      </button>
                    ))}
                  </div>
                  <Textarea aria-label="Feedback comment" placeholder="Anything else? (optional)" maxLength={1000} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
                  <Button loading={busy} disabled={rating === 0} onClick={submitFeedback}>Submit feedback</Button>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              {role !== "CUSTOMER" && <Row label="Customer" value={c.customer ? `${c.customer.name}${c.customer.email ? ` (${c.customer.email})` : ""}` : "-"} />}
              <Row label="Assigned to" value={c.assignedTo?.name ?? "Unassigned"} />
              <Row label="Department" value={c.department?.name ?? "-"} />
              <Row label="Created" value={formatDate(c.createdAt)} />
              <Row label="First reply due" value={formatDate(c.firstResponseDueAt)} />
              <Row label="First replied" value={formatDate(c.firstRespondedAt)} />
              <div><dt className="text-xs text-slate-500">Resolution deadline</dt><dd className="mt-0.5">{formatDate(c.resolutionDueAt)} <div><SlaTimer complaint={c} /></div></dd></div>
              {c.resolvedAt && <Row label="Resolved" value={formatDate(c.resolvedAt)} />}
              {c.isEscalated && <Row label="Escalated" value={formatDate(c.escalatedAt)} />}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">History</h2>
            <ol className="mt-3 space-y-4 border-l border-slate-200 pl-4">
              {c.statusHistory.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500" />
                  <p className="text-sm font-medium text-slate-800">{humanize(h.status)}</p>
                  <p className="text-xs text-slate-500">{formatDate(h.at)}{h.by ? ` · ${h.by.name}` : " · System"}</p>
                  {h.note && <p className="mt-1 text-xs text-slate-600">{h.note}</p>}
                </li>
              ))}
              {c.escalationHistory.map((e, i) => (
                <li key={`e${i}`} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                  <p className="text-sm font-medium text-red-700">Escalated</p>
                  <p className="text-xs text-slate-500">{formatDate(e.at)} · {e.reason}</p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <Modal open={modal === "assign"} title="Assign complaint" onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} disabled={!employeeId} onClick={() => act(() => complaintApi.assign(c.id, employeeId), "Complaint assigned")}>Assign</Button></>}>
        <Field label="Employee" htmlFor="assignee">
          <Select id="assignee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select an employee</option>
            {(employeesQ.data?.items ?? []).map((e) => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
          </Select>
        </Field>
        {employeesQ.data && employeesQ.data.items.length === 0 && <p className="mt-2 text-sm text-slate-500">No employees yet. Add one on the Employees page.</p>}
      </Modal>

      <Modal open={modal === "resolve"} title="Resolve complaint" onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} disabled={note.trim().length < 3} onClick={() => act(() => complaintApi.setStatus(c.id, "RESOLVED", note.trim()), "Complaint resolved")}>Mark resolved</Button></>}>
        <Field label="Resolution note" htmlFor="resolution" hint="The customer will see this.">
          <Textarea id="resolution" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>

      <Modal open={modal === "priority"} title="Change complaint priority" onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} onClick={() => act(() => complaintApi.setPriority(c.id, selectedPriority), "Priority updated")}>Update priority</Button></>}>
        <Field label="Priority level" htmlFor="priority" hint="Changing priority automatically recalculates SLA first-response and resolution deadlines.">
          <Select id="priority" value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
      </Modal>

      <Modal open={modal === "reopen"} title="Reopen complaint" onClose={() => setModal(null)}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button loading={busy} disabled={note.trim().length < 5} onClick={() => act(() => complaintApi.reopen(c.id, note.trim()), "Complaint reopened")}>Reopen</Button></>}>
        <Field label="Why are you reopening?" htmlFor="reason"><Textarea id="reason" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>

      <ConfirmDialog open={modal === "close"} title="Close this complaint?" message="A closed complaint can no longer be reopened or commented on." confirmLabel="Close complaint"
        loading={busy} onConfirm={() => act(() => complaintApi.close(c.id), "Complaint closed")} onCancel={() => setModal(null)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 text-slate-800">{value}</dd></div>;
}
