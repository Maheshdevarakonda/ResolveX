import { Request } from "express";
import { Types } from "mongoose";
import { AuditAction, AuditLog } from "../../models/AuditLog";
import { AuthUser } from "../../middleware/authenticate";
import { logger } from "../../utils/logger";

interface AuditInput {
  organizationId: string;
  actor: Pick<AuthUser, "id" | "name" | "role"> | null; // null = the system itself (SLA job)
  action: AuditAction;
  entityType: string;
  entityId?: string | Types.ObjectId;
  complaintId?: string | Types.ObjectId;
  changes?: { before?: unknown; after?: unknown };
  ip?: string;
}

// Writes one audit entry. A failure here is logged but never breaks the user's action.
// (Trade-off documented in docs/ARCHITECTURE.md: availability over strict audit completeness.)
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      organizationId: new Types.ObjectId(input.organizationId),
      actorId: input.actor ? new Types.ObjectId(input.actor.id) : undefined,
      actorName: input.actor?.name ?? "System",
      actorRole: input.actor?.role ?? "SYSTEM",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ? new Types.ObjectId(String(input.entityId)) : undefined,
      complaintId: input.complaintId ? new Types.ObjectId(String(input.complaintId)) : undefined,
      changes: input.changes,
      ip: input.ip,
    });
  } catch (err) {
    logger.error("Failed to write audit log", err);
  }
}

// Convenience for controllers: pulls actor, organization and IP out of the request.
export function auditFromRequest(
  req: Request,
  data: Omit<AuditInput, "organizationId" | "actor" | "ip">
): Promise<void> {
  return recordAudit({
    ...data,
    organizationId: req.user!.organizationId,
    actor: req.user!,
    ip: req.ip,
  });
}
