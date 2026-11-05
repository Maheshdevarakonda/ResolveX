import { Schema, Types, model } from "mongoose";

export const AUDIT_ACTIONS = [
  "COMPLAINT_CREATED",
  "COMPLAINT_ASSIGNED",
  "COMPLAINT_ACCEPTED",
  "COMPLAINT_STATUS_CHANGED",
  "COMPLAINT_PRIORITY_CHANGED",
  "COMPLAINT_CLOSED",
  "COMPLAINT_REOPENED",
  "COMPLAINT_ESCALATED",
  "COMMENT_ADDED",
  "ATTACHMENT_ADDED",
  "FEEDBACK_SUBMITTED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DEACTIVATED",
  "USER_ACTIVATED",
  "DEPARTMENT_CREATED",
  "DEPARTMENT_UPDATED",
  "DEPARTMENT_DELETED",
  "SLA_POLICY_UPDATED",
  "ORGANIZATION_UPDATED",
  "PASSWORD_RESET",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface IAuditLog {
  organizationId: Types.ObjectId;
  actorId?: Types.ObjectId; // missing = the system (e.g. the SLA job)
  actorName: string; // copied at write time so old logs stay readable if a user is renamed/removed
  actorRole: string; // CUSTOMER | EMPLOYEE | ADMIN | SYSTEM
  action: AuditAction;
  entityType: string; // COMPLAINT, USER, DEPARTMENT, SLA_POLICY, ORGANIZATION
  entityId?: Types.ObjectId;
  complaintId?: Types.ObjectId;
  changes?: { before?: unknown; after?: unknown };
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String, required: true, maxlength: 100 },
    actorRole: { type: String, required: true, maxlength: 20 },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entityType: { type: String, required: true, maxlength: 40 },
    entityId: { type: Schema.Types.ObjectId },
    complaintId: { type: Schema.Types.ObjectId, ref: "Complaint" },
    changes: { type: Schema.Types.Mixed },
    ip: { type: String, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, complaintId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, actorId: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
