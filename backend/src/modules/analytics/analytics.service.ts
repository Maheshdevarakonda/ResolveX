import { Types } from "mongoose";
import { Complaint } from "../../models/Complaint";
import { Feedback } from "../../models/Feedback";
import { User } from "../../models/User";
import { tenantFilter } from "../../utils/tenant";

const MS_PER_HOUR = 3_600_000;
const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;

// IMPORTANT: aggregate() does NOT cast ids for you, so tenantFilter() (which returns a real
// ObjectId) is used as the first $match stage of every pipeline.

export async function summary(organizationId: string) {
  const match = tenantFilter(organizationId);

  const [result] = await Complaint.aggregate([
    { $match: match },
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
        byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
        escalated: [
          { $match: { isEscalated: true, status: { $in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED"] } } },
          { $count: "count" },
        ],
        // resolvedAt exists only while a complaint is RESOLVED or CLOSED (reopening removes it).
        resolved: [
          { $match: { resolvedAt: { $type: "date" } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } },
              withinSla: { $sum: { $cond: [{ $lte: ["$resolvedAt", "$resolutionDueAt"] }, 1, 0] } },
            },
          },
        ],
        responded: [
          { $match: { firstRespondedAt: { $type: "date" } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              withinSla: { $sum: { $cond: [{ $lte: ["$firstRespondedAt", "$firstResponseDueAt"] }, 1, 0] } },
              avgMs: { $avg: { $subtract: ["$firstRespondedAt", "$createdAt"] } },
            },
          },
        ],
      },
    },
  ]);

  const countMap = (rows: { _id: string; count: number }[]) =>
    Object.fromEntries(rows.map((r) => [r._id, r.count])) as Record<string, number>;

  const byStatus = countMap(result.byStatus);
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const done = (byStatus.RESOLVED ?? 0) + (byStatus.CLOSED ?? 0);
  const resolved = result.resolved[0];
  const responded = result.responded[0];

  const [rating] = await Feedback.aggregate<{ avg: number; count: number }>([
    { $match: match },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  return {
    total,
    pending: total - done,
    resolved: done,
    escalated: result.escalated[0]?.count ?? 0,
    resolutionRate: total ? round((done / total) * 100) : null, // percent
    avgResolutionHours: resolved ? round(resolved.avgMs / MS_PER_HOUR) : null,
    slaCompliance: resolved && resolved.count ? round((resolved.withinSla / resolved.count) * 100) : null, // percent of resolved complaints finished before their deadline
    firstResponseCompliance: responded && responded.count ? round((responded.withinSla / responded.count) * 100) : null,
    avgFirstResponseHours: responded ? round(responded.avgMs / MS_PER_HOUR) : null,
    avgRating: rating ? round(rating.avg, 2) : null,
    ratingCount: rating?.count ?? 0,
    byStatus,
    byPriority: countMap(result.byPriority),
    byCategory: countMap(result.byCategory),
  };
}

export async function byDepartment(organizationId: string) {
  const rows = await Complaint.aggregate([
    { $match: tenantFilter(organizationId) },
    {
      $group: {
        _id: "$departmentId",
        total: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $in: ["$status", ["RESOLVED", "CLOSED"]] }, 1, 0] } },
        escalated: { $sum: { $cond: ["$isEscalated", 1, 0] } },
        avgMs: {
          $avg: {
            $cond: [{ $eq: [{ $type: "$resolvedAt" }, "date"] }, { $subtract: ["$resolvedAt", "$createdAt"] }, null],
          },
        },
      },
    },
    { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dept" } },
    { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
    { $sort: { total: -1 } },
  ]);

  return rows.map((r) => ({
    departmentId: r._id ? String(r._id) : null,
    name: r.dept?.name ?? "Unassigned",
    total: r.total as number,
    resolved: r.resolved as number,
    escalated: r.escalated as number,
    avgResolutionHours: r.avgMs != null ? round(r.avgMs / MS_PER_HOUR) : null,
  }));
}

// Complaints created and resolved per day (UTC) for the last `days` days, zero-filled.
export async function trends(organizationId: string, days: number) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const match = tenantFilter(organizationId);
  const day = (field: string) => ({ $dateToString: { format: "%Y-%m-%d", date: field, timezone: "UTC" } });

  const [created, resolved] = await Promise.all([
    Complaint.aggregate<{ _id: string; count: number }>([
      { $match: { ...match, createdAt: { $gte: start } } },
      { $group: { _id: day("$createdAt"), count: { $sum: 1 } } },
    ]),
    Complaint.aggregate<{ _id: string; count: number }>([
      { $match: { ...match, resolvedAt: { $gte: start } } },
      { $group: { _id: day("$resolvedAt"), count: { $sum: 1 } } },
    ]),
  ]);

  const createdMap = new Map(created.map((r) => [r._id, r.count]));
  const resolvedMap = new Map(resolved.map((r) => [r._id, r.count]));
  const points = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    points.push({ date: key, created: createdMap.get(key) ?? 0, resolved: resolvedMap.get(key) ?? 0 });
  }
  return points;
}

// Open work per employee. `onlyUserId` limits the result to one person (used for employees).
export async function workload(organizationId: string, onlyUserId?: string) {
  const match = tenantFilter(organizationId);
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * MS_PER_HOUR);
  const weekAgo = new Date(now.getTime() - 7 * 24 * MS_PER_HOUR);

  const employees = await User.find({
    ...match,
    role: "EMPLOYEE",
    isActive: true,
    ...(onlyUserId ? { _id: new Types.ObjectId(onlyUserId) } : {}),
  })
    .select("name email")
    .lean();

  const rows = await Complaint.aggregate([
    { $match: { ...match, assignedTo: { $in: employees.map((e) => e._id) } } },
    {
      $group: {
        _id: "$assignedTo",
        assigned: { $sum: { $cond: [{ $eq: ["$status", "ASSIGNED"] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $in: ["$status", ["IN_PROGRESS", "REOPENED"]] }, 1, 0] } },
        escalated: {
          $sum: { $cond: [{ $and: ["$isEscalated", { $in: ["$status", ["ASSIGNED", "IN_PROGRESS", "REOPENED"]] }] }, 1, 0] },
        },
        dueSoon: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", ["ASSIGNED", "IN_PROGRESS", "REOPENED"]] },
                  { $gt: ["$resolutionDueAt", now] },
                  { $lte: ["$resolutionDueAt", soon] },
                ],
              },
              1,
              0,
            ],
          },
        },
        resolvedLast7Days: { $sum: { $cond: [{ $gte: ["$resolvedAt", weekAgo] }, 1, 0] } },
      },
    },
  ]);

  const byUser = new Map(rows.map((r) => [String(r._id), r]));
  return employees.map((e) => {
    const r = byUser.get(String(e._id));
    const assigned = r?.assigned ?? 0;
    const inProgress = r?.inProgress ?? 0;
    return {
      employeeId: String(e._id),
      name: e.name,
      email: e.email,
      assigned,
      inProgress,
      open: assigned + inProgress,
      escalated: r?.escalated ?? 0,
      dueSoon: r?.dueSoon ?? 0,
      resolvedLast7Days: r?.resolvedLast7Days ?? 0,
    };
  });
}
