import { Types } from "mongoose";
import { z } from "zod";
import { AuthUser } from "../../middleware/authenticate";
import { Feedback } from "../../models/Feedback";
import { ApiError } from "../../utils/ApiError";
import { PaginationMeta, buildMeta } from "../../utils/pagination";
import { tenantFilter } from "../../utils/tenant";
import { recordAudit } from "../audit/audit.service";
import { findScoped } from "../complaints/complaint.service";

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export async function submitFeedback(actor: AuthUser, complaintId: string, input: z.infer<typeof feedbackSchema>) {
  const complaint = await findScoped(actor, complaintId); // customers only see their own complaints
  if (!["RESOLVED", "CLOSED"].includes(complaint.status)) {
    throw ApiError.conflict("Feedback can be given once the complaint is resolved");
  }

  const existing = await Feedback.exists({ complaintId: complaint._id });
  if (existing) throw ApiError.conflict("Feedback was already submitted for this complaint");

  const feedback = await Feedback.create({
    organizationId: new Types.ObjectId(actor.organizationId),
    complaintId: complaint._id,
    customerId: new Types.ObjectId(actor.id),
    rating: input.rating,
    ...(input.comment ? { comment: input.comment } : {}),
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actor,
    action: "FEEDBACK_SUBMITTED",
    entityType: "COMPLAINT",
    entityId: complaint._id,
    complaintId: complaint._id,
    changes: { after: { rating: input.rating } },
  });
  return { id: String(feedback._id), rating: feedback.rating, comment: feedback.comment ?? null, createdAt: feedback.createdAt };
}

export async function getFeedbackFor(actor: AuthUser, complaintId: string) {
  const complaint = await findScoped(actor, complaintId);
  const f = await Feedback.findOne({ complaintId: complaint._id, ...tenantFilter(actor.organizationId) });
  return f ? { id: String(f._id), rating: f.rating, comment: f.comment ?? null, createdAt: f.createdAt } : null;
}

export async function listFeedback(
  organizationId: string,
  page: number,
  limit: number
): Promise<{ items: unknown[]; meta: PaginationMeta & { averageRating: number | null } }> {
  const filter = tenantFilter(organizationId);
  const [docs, total, avg] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("complaintId", "ticketNo title")
      .populate("customerId", "name")
      .lean(),
    Feedback.countDocuments(filter),
    Feedback.aggregate<{ avg: number }>([{ $match: filter }, { $group: { _id: null, avg: { $avg: "$rating" } } }]),
  ]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const items = docs.map((f: any) => ({
    id: String(f._id),
    rating: f.rating,
    comment: f.comment ?? null,
    complaint: f.complaintId ? { id: String(f.complaintId._id), ticketNo: f.complaintId.ticketNo, title: f.complaintId.title } : null,
    customer: f.customerId ? { id: String(f.customerId._id), name: f.customerId.name } : null,
    createdAt: f.createdAt,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return { items, meta: { ...buildMeta(page, limit, total), averageRating: avg[0]?.avg ?? null } };
}
