import { Types } from "mongoose";
import { z } from "zod";
import { AuthUser } from "../../middleware/authenticate";
import { Comment } from "../../models/Comment";
import { Complaint } from "../../models/Complaint";
import { ApiError } from "../../utils/ApiError";
import { adminIds } from "../../utils/recipients";
import { tenantFilter } from "../../utils/tenant";
import { recordAudit } from "../audit/audit.service";
import { findScoped } from "../complaints/complaint.service";
import { notify } from "../notifications/notification.service";

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
  isInternal: z.boolean().optional(), // ignored for customers
});

export interface CommentDto {
  id: string;
  body: string;
  isInternal: boolean;
  author: { id: string; name: string; role: string } | null;
  createdAt: Date;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toDto(c: any): CommentDto {
  const a = c.authorId;
  return {
    id: String(c._id),
    body: c.body,
    isInternal: c.isInternal,
    author: a && a.name ? { id: String(a._id), name: a.name, role: a.role } : null,
    createdAt: c.createdAt,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listComments(actor: AuthUser, complaintId: string): Promise<CommentDto[]> {
  await findScoped(actor, complaintId); // 404 if the complaint is not visible to this user
  const filter = {
    complaintId: new Types.ObjectId(complaintId),
    ...tenantFilter(actor.organizationId),
    // Customers never see internal notes.
    ...(actor.role === "CUSTOMER" ? { isInternal: false } : {}),
  };
  const comments = await Comment.find(filter)
    .sort({ createdAt: 1 })
    .limit(500)
    .populate("authorId", "name role")
    .lean();
  return comments.map(toDto);
}

export async function addComment(
  actor: AuthUser,
  complaintId: string,
  input: z.infer<typeof createCommentSchema>
): Promise<CommentDto> {
  const complaint = await findScoped(actor, complaintId);
  if (complaint.status === "CLOSED") throw ApiError.conflict("This complaint is closed");

  const isStaff = actor.role !== "CUSTOMER";
  const isInternal = isStaff && input.isInternal === true; // customers cannot write internal notes

  // An unassigned OPEN complaint is visible to employees so they can accept it, but only the
  // assignee (or an admin) may reply to the customer.
  if (actor.role === "EMPLOYEE" && String(complaint.assignedTo) !== actor.id) {
    throw ApiError.conflict("Accept this complaint before commenting");
  }

  const comment = await Comment.create({
    organizationId: new Types.ObjectId(actor.organizationId),
    complaintId: complaint._id,
    authorId: new Types.ObjectId(actor.id),
    body: input.body,
    isInternal,
  });

  // The first public staff reply counts as the "first response" for SLA reporting.
  if (isStaff && !isInternal && !complaint.firstRespondedAt) {
    await Complaint.updateOne(
      { _id: complaint._id, ...tenantFilter(actor.organizationId), firstRespondedAt: { $exists: false } },
      { $set: { firstRespondedAt: new Date() } }
    );
  }

  await recordAudit({
    organizationId: actor.organizationId,
    actor,
    action: "COMMENT_ADDED",
    entityType: "COMPLAINT",
    entityId: complaint._id,
    complaintId: complaint._id,
    changes: { after: { isInternal } },
  });

  if (!isInternal) {
    const recipients = isStaff
      ? [String(complaint.customerId)]
      : complaint.assignedTo
        ? [String(complaint.assignedTo)]
        : await adminIds(actor.organizationId);
    await notify({
      organizationId: actor.organizationId,
      userIds: recipients,
      type: "COMMENT",
      complaintId: String(complaint._id),
      message: `${actor.name} replied on ${complaint.ticketNo}`,
      excludeUserId: actor.id,
    });
  }

  return {
    id: String(comment._id),
    body: comment.body,
    isInternal: comment.isInternal,
    author: { id: actor.id, name: actor.name, role: actor.role },
    createdAt: comment.createdAt,
  };
}
