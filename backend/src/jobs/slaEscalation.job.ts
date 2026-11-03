import cron from "node-cron";
import { env } from "../config/env";
import { ACTIVE_STATUSES, Complaint } from "../models/Complaint";
import { adminIds } from "../utils/recipients";
import { logger } from "../utils/logger";
import { recordAudit } from "../modules/audit/audit.service";
import { notify } from "../modules/notifications/notification.service";

// Finds complaints whose resolution deadline has passed and escalates each one EXACTLY once.
//
// Why a duplicate escalation cannot happen: the update below only matches while isEscalated is
// still false, and MongoDB applies it atomically. If the job runs twice (or two server instances
// run it at once), the second update matches nothing and is skipped.
export async function runSlaCheck(now: Date = new Date()): Promise<{ escalated: number; warned: number }> {
  let escalated = 0;
  let warned = 0;

  // 1) Escalate overdue complaints.
  const overdue = await Complaint.find({
    status: { $in: ACTIVE_STATUSES },
    isEscalated: false,
    resolutionDueAt: { $lt: now },
  })
    .select("_id")
    .limit(500)
    .lean();

  for (const { _id } of overdue) {
    const updated = await Complaint.findOneAndUpdate(
      { _id, status: { $in: ACTIVE_STATUSES }, isEscalated: false, resolutionDueAt: { $lt: now } },
      {
        $set: { isEscalated: true, escalatedAt: now },
        $push: { escalationHistory: { at: now, reason: "Resolution deadline missed", level: 1 } },
      },
      { new: true }
    );
    if (!updated) continue; // another run got there first

    escalated++;
    const orgId = String(updated.organizationId);
    await recordAudit({
      organizationId: orgId,
      actor: null,
      action: "COMPLAINT_ESCALATED",
      entityType: "COMPLAINT",
      entityId: updated._id,
      complaintId: updated._id,
      changes: { after: { isEscalated: true, reason: "Resolution deadline missed" } },
    });
    await notify({
      organizationId: orgId,
      userIds: [...(await adminIds(orgId)), updated.assignedTo ? String(updated.assignedTo) : null],
      type: "ESCALATED",
      complaintId: String(updated._id),
      message: `Complaint ${updated.ticketNo} missed its deadline and was escalated`,
    });
  }

  // 2) Warn about complaints that are about to breach (once each).
  const warnUntil = new Date(now.getTime() + env.SLA_WARNING_MINUTES * 60_000);
  const soon = await Complaint.find({
    status: { $in: ACTIVE_STATUSES },
    isEscalated: false,
    slaWarnedAt: null,
    resolutionDueAt: { $gt: now, $lte: warnUntil },
  })
    .select("_id")
    .limit(500)
    .lean();

  for (const { _id } of soon) {
    const updated = await Complaint.findOneAndUpdate(
      { _id, isEscalated: false, slaWarnedAt: null, status: { $in: ACTIVE_STATUSES } },
      { $set: { slaWarnedAt: now } },
      { new: true }
    );
    if (!updated) continue;

    warned++;
    const orgId = String(updated.organizationId);
    await notify({
      organizationId: orgId,
      userIds: updated.assignedTo ? [String(updated.assignedTo)] : await adminIds(orgId),
      type: "SLA_WARNING",
      complaintId: String(updated._id),
      message: `Complaint ${updated.ticketNo} is due within ${env.SLA_WARNING_MINUTES} minutes`,
    });
  }

  if (escalated || warned) logger.info(`SLA check: ${escalated} escalated, ${warned} warned`);
  return { escalated, warned };
}

// Runs once a minute inside the API process. No Redis/queue is needed because the work is
// idempotent (see above) and the query is covered by an index.
export function startSlaJob(): void {
  if (!env.ENABLE_SLA_JOB) {
    logger.info("SLA job disabled (ENABLE_SLA_JOB=false)");
    return;
  }
  cron.schedule("* * * * *", () => {
    runSlaCheck().catch((err) => logger.error("SLA job failed", err));
  });
  logger.info("SLA job scheduled (every minute)");
  runSlaCheck().catch((err) => logger.error("Initial SLA check failed", err));
}
