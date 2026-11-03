import { cn, formatDuration } from "../utils/format";
import type { Complaint } from "../types";

// Shows how much time is left to resolve a complaint, or whether the deadline was met.
export function SlaTimer({ complaint }: { complaint: Pick<Complaint, "status" | "resolutionDueAt" | "resolvedAt" | "isEscalated"> }) {
  const due = new Date(complaint.resolutionDueAt).getTime();

  if (complaint.resolvedAt) {
    const met = new Date(complaint.resolvedAt).getTime() <= due;
    return <span className={cn("text-xs font-medium", met ? "text-emerald-600" : "text-red-600")}>{met ? "Deadline met" : "Deadline missed"}</span>;
  }
  const diff = due - Date.now();
  if (diff < 0) return <span className="text-xs font-semibold text-red-600">Overdue by {formatDuration(-diff)}</span>;
  return <span className={cn("text-xs font-medium", diff < 3_600_000 ? "text-amber-600" : "text-slate-500")}>Due in {formatDuration(diff)}</span>;
}
