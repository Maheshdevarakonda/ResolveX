import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { AUDIT_ACTIONS, AuditLog } from "../../models/AuditLog";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { buildMeta, paginationFields } from "../../utils/pagination";
import { tenantFilter } from "../../utils/tenant";
import { objectIdString } from "../../utils/validators";

const querySchema = z.object({
  ...paginationFields,
  actorId: objectIdString.optional(),
  complaintId: objectIdString.optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const router = Router();
router.use(authenticate, authorize("ADMIN"));

router.get(
  "/",
  validate({ query: querySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof querySchema>;
    const filter: Record<string, unknown> = { ...tenantFilter(req.user!.organizationId) };
    if (q.actorId) filter.actorId = new Types.ObjectId(q.actorId);
    if (q.complaintId) filter.complaintId = new Types.ObjectId(q.complaintId);
    if (q.action) filter.action = q.action;
    if (q.from || q.to) {
      filter.createdAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate("complaintId", "ticketNo")
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const items = logs.map((l: any) => ({
      id: String(l._id),
      action: l.action,
      actorName: l.actorName,
      actorRole: l.actorRole,
      entityType: l.entityType,
      complaint: l.complaintId?.ticketNo ? { id: String(l.complaintId._id), ticketNo: l.complaintId.ticketNo } : null,
      changes: l.changes ?? null,
      ip: l.ip ?? null,
      createdAt: l.createdAt,
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
    sendSuccess(res, items, "OK", 200, { ...buildMeta(q.page, q.limit, total) });
  })
);

export default router;
