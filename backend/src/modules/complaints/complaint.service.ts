import { FilterQuery, Types } from "mongoose";
import { AuthUser } from "../../middleware/authenticate";
import { ACTIVE_STATUSES, Complaint, IComplaint, STATUSES, Status } from "../../models/Complaint";
import { Comment } from "../../models/Comment";
import { nextTicketNo } from "../../models/Counter";
import { Department } from "../../models/Department";
import { Organization } from "../../models/Organization";
import { User } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { PaginationMeta, buildMeta } from "../../utils/pagination";
import { adminIds } from "../../utils/recipients";
import { tenantFilter } from "../../utils/tenant";
import { escapeRegex } from "../../utils/validators";
import { notify } from "../notifications/notification.service";
import { recordAudit } from "../audit/audit.service";
import { computeDueDates, getPolicy } from "../sla/sla.service";
import {
  AssignInput,
  CreateComplaintInput,
  ListComplaintsQuery,
  StatusInput,
} from "./complaint.schema";

type Actor = AuthUser;

// ---------- who may see what (tenant isolation + role scope) ----------

// CUSTOMER: only their own complaints.
// EMPLOYEE: complaints assigned to them, plus unassigned OPEN ones (so they can accept work).
// ADMIN: everything in the organization.
// Every filter starts from tenantFilter(), so no role can ever cross organizations.
export function scopeFilter(actor: Actor): FilterQuery<IComplaint> {
  const base = tenantFilter(actor.organizationId);
  const me = new Types.ObjectId(actor.id);
  if (actor.role === "CUSTOMER") return { ...base, customerId: me };
  if (actor.role === "EMPLOYEE") {
    return { ...base, $or: [{ assignedTo: me }, { assignedTo: null, status: "OPEN" }] };
  }
  return base;
}

const POPULATE = [
  { path: "customerId", select: "name email" },
  { path: "assignedTo", select: "name email" },
  { path: "departmentId", select: "name" },
];

// ---------- output shape ----------

/* eslint-disable @typescript-eslint/no-explicit-any */
const isPopulated = (v: any) => v && typeof v === "object" && "name" in v;
const refUser = (v: any) =>
  !v ? null : isPopulated(v) ? { id: String(v._id), name: v.name, email: v.email } : { id: String(v), name: "", email: "" };
const refDept = (v: any) =>
  !v ? null : isPopulated(v) ? { id: String(v._id), name: v.name } : { id: String(v), name: "" };

export function toComplaintDto(c: any) {
  return {
    id: String(c._id),
    ticketNo: c.ticketNo,
    title: c.title,
    description: c.description,
    category: c.category,
    priority: c.priority,
    status: c.status,
    customer: refUser(c.customerId),
    assignedTo: refUser(c.assignedTo),
    department: refDept(c.departmentId),
    attachments: (c.attachments ?? []).map((a: any) => ({
      url: a.url,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
    })),
    firstResponseDueAt: c.firstResponseDueAt,
    resolutionDueAt: c.resolutionDueAt,
    firstRespondedAt: c.firstRespondedAt ?? null,
    resolvedAt: c.resolvedAt ?? null,
    closedAt: c.closedAt ?? null,
    isEscalated: c.isEscalated,
    escalatedAt: c.escalatedAt ?? null,
    escalationHistory: c.escalationHistory ?? [],
    reopenCount: c.reopenCount ?? 0,
    resolutionNote: c.resolutionNote ?? null,
    statusHistory: (c.statusHistory ?? []).map((h: any) => ({
      status: h.status,
      at: h.at,
      note: h.note ?? null,
      by: h.by && isPopulated(h.by) ? { id: String(h.by._id), name: h.by.name } : null,
    })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type ComplaintDto = ReturnType<typeof toComplaintDto>;

// A complaint outside the caller's scope is reported as "not found", never "forbidden".
export async function findScoped(actor: Actor, id: string) {
  const complaint = await Complaint.findOne({ _id: id, ...scopeFilter(actor) });
  if (!complaint) throw ApiError.notFound("Complaint not found");
  return complaint;
}

export async function getComplaintDto(actor: Actor, id: string): Promise<ComplaintDto> {
  const complaint = await Complaint.findOne({ _id: id, ...scopeFilter(actor) })
    .populate(POPULATE)
    .populate({ path: "statusHistory.by", select: "name" });
  if (!complaint) throw ApiError.notFound("Complaint not found");
  return toComplaintDto(complaint.toObject());
}

// ---------- create / list / stats ----------

export async function createComplaint(actor: Actor, input: CreateComplaintInput): Promise<ComplaintDto> {
  const organizationId = new Types.ObjectId(actor.organizationId);
  const now = new Date();
  const policy = await getPolicy(actor.organizationId, input.priority);

  const complaint = await Complaint.create({
    organizationId,
    ticketNo: await nextTicketNo(organizationId),
    ...input,
    status: "OPEN",
    customerId: new Types.ObjectId(actor.id),
    ...computeDueDates(policy, now),
    statusHistory: [{ status: "OPEN", by: new Types.ObjectId(actor.id), at: now }],
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actor,
    action: "COMPLAINT_CREATED",
    entityType: "COMPLAINT",
    entityId: complaint._id,
    complaintId: complaint._id,
    changes: { after: { ticketNo: complaint.ticketNo, priority: complaint.priority, category: complaint.category } },
  });
  await notify({
    organizationId: actor.organizationId,
    userIds: await adminIds(actor.organizationId),
    type: "COMPLAINT_CREATED",
    complaintId: String(complaint._id),
    message: `New ${complaint.priority.toLowerCase()} complaint ${complaint.ticketNo}: ${complaint.title}`,
    excludeUserId: actor.id,
  });

  return getComplaintDto(actor, String(complaint._id));
}

export async function listComplaints(
  actor: Actor,
  q: ListComplaintsQuery
): Promise<{ items: ComplaintDto[]; meta: PaginationMeta }> {
  const and: FilterQuery<IComplaint>[] = [];
  if (q.status) and.push({ status: q.status });
  if (q.priority) and.push({ priority: q.priority });
  if (q.category) and.push({ category: q.category });
  if (q.departmentId) and.push({ departmentId: new Types.ObjectId(q.departmentId) });
  if (q.assignedTo) and.push({ assignedTo: new Types.ObjectId(q.assignedTo) });
  if (q.isEscalated !== undefined) and.push({ isEscalated: q.isEscalated });
  if (q.q) {
    const pattern = new RegExp(escapeRegex(q.q), "i");
    and.push({ $or: [{ title: pattern }, { ticketNo: pattern }] });
  }

  // Role scope goes in the top-level filter, user filters in $and, so a client filter can never widen scope.
  const filter: FilterQuery<IComplaint> = { ...scopeFilter(actor), ...(and.length ? { $and: and } : {}) };
  const sort: Record<string, 1 | -1> =
    q.sort === "oldest" ? { createdAt: 1 } : q.sort === "due" ? { resolutionDueAt: 1 } : { createdAt: -1 };

  const [docs, total] = await Promise.all([
    Complaint.find(filter)
      .select("-statusHistory -escalationHistory")
      .populate(POPULATE)
      .sort(sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Complaint.countDocuments(filter),
  ]);

  return { items: docs.map(toComplaintDto), meta: buildMeta(q.page, q.limit, total) };
}

// Counts per status for the caller's own scope (powers the dashboards).
export async function complaintStats(actor: Actor) {
  const rows = await Complaint.aggregate<{ _id: Status; count: number }>([
    { $match: scopeFilter(actor) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const r of rows) byStatus[r._id] = r.count;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const escalated = await Complaint.countDocuments({ ...scopeFilter(actor), isEscalated: true, status: { $in: ACTIVE_STATUSES } });
  return { total, byStatus, escalated };
}

// ---------- assignment ----------

export async function assignComplaint(actor: Actor, id: string, input: AssignInput): Promise<ComplaintDto> {
  const complaint = await findScoped(actor, id);
  if (!["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED"].includes(complaint.status)) {
    throw ApiError.conflict(`A ${complaint.status.toLowerCase()} complaint cannot be assigned`);
  }

  const employee = await User.findOne({
    _id: input.employeeId,
    role: "EMPLOYEE",
    isActive: true,
    ...tenantFilter(actor.organizationId),
  });
  if (!employee) throw ApiError.notFound("Employee not found");

  if (input.departmentId) {
    const dept = await Department.exists({ _id: input.departmentId, ...tenantFilter(actor.organizationId) });
    if (!dept) throw ApiError.notFound("Department not found");
  }

  const before = { assignedTo: complaint.assignedTo ? String(complaint.assignedTo) : null, status: complaint.status };
  complaint.assignedTo = employee._id;
  complaint.departmentId = input.departmentId
    ? new Types.ObjectId(input.departmentId)
    : employee.departmentId ?? complaint.departmentId ?? null;
  if (complaint.status === "OPEN") {
    complaint.status = "ASSIGNED";
    complaint.statusHistory.push({ status: "ASSIGNED", by: new Types.ObjectId(actor.id), at: new Date() });
  }
  await complaint.save();

  await recordAudit({
    organizationId: actor.organizationId,
    actor,
    action: "COMPLAINT_ASSIGNED",
    entityType: "COMPLAINT",
    entityId: complaint._id,
    complaintId: complaint._id,
    changes: { before, after: { assignedTo: String(employee._id), status: complaint.status } },
  });
  await notify({
    organizationId: actor.organizationId,
    userIds: [String(employee._id)],
    type: "ASSIGNED",
    complaintId: String(complaint._id),
    message: `Complaint ${complaint.ticketNo} was assigned to you`,
    excludeUserId: actor.id,
  });
  await notify({
    organizationId: actor.organizationId,
    userIds: [String(complaint.customerId)],
    type: "STATUS_CHANGED",
    complaintId: String(complaint._id),
    message: `Your complaint ${complaint.ticketNo} was assigned to ${employee.name}`,
  });

  return getComplaintDto(actor, id);
}

// An employee claims an unassigned OPEN complaint. The conditional update is atomic:
// if two employees click at once, exactly one wins and the other gets 409.
export async function acceptComplaint(actor: Actor, id: string): Promise<ComplaintDto> {
  const me = new Types.ObjectId(actor.id);
  const employee = await User.findById(me).select("departmentId").lean();
  const now = new Date();

  const claimed = await Complaint.findOneAndUpdate(
    { _id: id, ...tenantFilter(actor.organizationId), status: "OPEN", assignedTo: null },
    {
      $set: {
        assignedTo: me,
        status: "ASSIGNED",
        ...(employee?.departmentId ? { departmentId: employee.departmentId } : {}),
      },
      $push: { statusHistory: { status: "ASSIGNED", by: me, at: now, note: "Accepted by employee" } },
    },
    { new: true }
  );

  if (!claimed) {
    const exists = await Complaint.exists({ _id: id, ...tenantFilter(actor.organizationId) });
    throw exists ? ApiError.conflict("This complaint was already taken") : ApiError.notFound("Complaint not found");
  }

  await recordAudit({
    organizationId: actor.organizationId,
    actor,
    action: "COMPLAINT_ACCEPTED",
    entityType: "COMPLAINT",
    entityId: claimed._id,
    complaintId: claimed._id,
    changes: { before: { status: "OPEN" }, after: { status: "ASSIGNED", assignedTo: actor.id } },
  });
  await notify({
    organizationId: actor.organizationId,
    userIds: [String(claimed.customerId)],
    type: "STATUS_CHANGED",
    complaintId: String(claimed._id),
    message: `Your complaint ${claimed.ticketNo} was accepted by ${actor.name}`,
  });
  return getComplaintDto(actor, id);
}

// ---------- status transitions ----------

// Allowed staff moves. RESOLVED -> CLOSED / REOPENED belong to the customer (and admin for close).
const STAFF_TRANSITIONS: Partial<Record<Status, Status[]>> = {
  ASSIGNED: ["IN_PROGRESS"],
  REOPENED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
};

export async function changeStatus(actor: Actor, id: string, input: StatusInput): Promise<ComplaintDto> {
  const complaint = await findScoped(actor, id);
  const current = complaint.status;

  if (actor.role === "EMPLOYEE" && String(complaint.assignedTo) !== actor.id) {
    throw ApiError.conflict("Accept this complaint before changing its status");
  }
  if (!STAFF_TRANSITIONS[current]?.includes(input.status)) {
    throw ApiError.conflict(`Cannot move a complaint from ${current} to ${input.status}`);
  }
  if (input.status === "RESOLVED" && (!input.note || input.note.length < 3)) {
    throw ApiError.badRequest("A resolution note is required when resolving a complaint");
  }

  const now = new Date();
  const by = new Types.ObjectId(actor.id);
  const set: Record<string, unknown> = { status: input.status };
  if (input.status === "RESOLVED") {
    set.resolvedAt = now;
    set.resolutionNote = input.note;
  }
  if (!complaint.firstRespondedAt) set.firstRespondedAt = now;

  // Including the current status in the filter makes this safe against two simultaneous changes.
  const updated = await Complaint.findOneAndUpdate(
    { _id: complaint._id, ...tenantFilter(actor.organizationId), status: current },
    {
      $set: set,
      $push: { statusHistory: { status: input.status, by, at: now, ...(input.note ? { note: input.note } : {}) } },
    },
    { new: true }
  );
  if (!updated) throw ApiError.conflict("The complaint was changed by someone else. Refresh and try again");

  await recordAudit({
    organizationId: actor.organizationId,
    actor,
    action: "COMPLAINT_STATUS_CHANGED",
    entityType: "COMPLAINT",
    entityId: updated._id,
    complaintId: updated._id,
    changes: { before: { status: current }, after: { status: input.status } },
  });
  await notify({
    organizationId: actor.organizationId,
    userIds: [String(updated.customerId)],
    type: "STATUS_CHANGED",
    complaintId: String(updated._id),
    message: `Your complaint ${updated.ticketNo} is now ${input.status.replace("_", " ").toLowerCase()}`,
  });
  return getComplaintDto(actor, id);
}

// Customer (owner) or admin closes a RESOLVED complaint.
export async function closeComplaint(actor: Actor, id: string): Promise<ComplaintDto> {
  const complaint = await findScoped(actor, id);
  if (complaint.status !== "RESOLVED") throw ApiError.conflict("Only resolved complaints can be closed");

  const now = new Date();
  const updated = await Complaint.findOneAndUpdate(
    { _id: complaint._id, ...tenantFilter(actor.organizationId), status: "RESOLVED" },
    {
      $set: { status: "CLOSED", closedAt: now },
      $push: { statusHistory: { status: "CLOSED", by: new Types.ObjectId(actor.id), at: now } },
    },
    { new: true }
  );
  if (!updated) throw ApiError.conflict("The complaint was changed by someone else. Refresh and try again");

  await recordAudit({
    organizationId: actor.organizationId,
    actor,
    action: "COMPLAINT_CLOSED",
    entityType: "COMPLAINT",
    entityId: updated._id,
    complaintId: updated._id,
    changes: { before: { status: "RESOLVED" }, after: { status: "CLOSED" } },
  });
  await notify({
    organizationId: actor.organizationId,
    userIds: [updated.assignedTo ? String(updated.assignedTo) : null],
    type: "STATUS_CHANGED",
    complaintId: String(updated._id),
    message: `Complaint ${updated.ticketNo} was closed`,
    excludeUserId: actor.id,
  });
  return getComplaintDto(actor, id);
}

// Customer reopens a RESOLVED complaint inside the organization's reopen window.
// The SLA clock restarts and the escalation flag resets (history is kept).
export async function reopenComplaint(actor: Actor, id: string, reason: string): Promise<ComplaintDto> {
  const complaint = await findScoped(actor, id);
  if (complaint.status !== "RESOLVED" || !complaint.resolvedAt) {
    throw ApiError.conflict("Only resolved complaints can be reopened");
  }

  const org = await Organization.findById(actor.organizationId).select("settings").lean();
  const windowDays = org?.settings?.reopenWindowDays ?? 7;
  const deadline = complaint.resolvedAt.getTime() + windowDays * 86_400_000;
  if (Date.now() > deadline) {
    throw ApiError.conflict(`This complaint can only be reopened within ${windowDays} days of resolution`);
  }

  const now = new Date();
  const policy = await getPolicy(actor.organizationId, complaint.priority);
  const { resolutionDueAt } = computeDueDates(policy, now);

  const updated = await Complaint.findOneAndUpdate(
    { _id: complaint._id, ...tenantFilter(actor.organizationId), status: "RESOLVED" },
    {
      $set: { status: "REOPENED", resolutionDueAt, isEscalated: false },
      $unset: { resolvedAt: "", slaWarnedAt: "", escalatedAt: "" },
      $inc: { reopenCount: 1 },
      $push: { statusHistory: { status: "REOPENED", by: new Types.ObjectId(actor.id), at: now, note: reason } },
    },
    { new: true }
  );
  if (!updated) throw ApiError.conflict("The complaint was changed by someone else. Refresh and try again");

  await Comment.create({
    organizationId: new Types.ObjectId(actor.organizationId),
    complaintId: updated._id,
    authorId: new Types.ObjectId(actor.id),
    body: `Reopened: ${reason}`,
    isInternal: false,
  });
  await recordAudit({
    organizationId: actor.organizationId,
    actor,
    action: "COMPLAINT_REOPENED",
    entityType: "COMPLAINT",
    entityId: updated._id,
    complaintId: updated._id,
    changes: { before: { status: "RESOLVED" }, after: { status: "REOPENED", reason } },
  });
  await notify({
    organizationId: actor.organizationId,
    userIds: updated.assignedTo ? [String(updated.assignedTo)] : await adminIds(actor.organizationId),
    type: "REOPENED",
    complaintId: String(updated._id),
    message: `Complaint ${updated.ticketNo} was reopened by the customer`,
    excludeUserId: actor.id,
  });
  return getComplaintDto(actor, id);
}
