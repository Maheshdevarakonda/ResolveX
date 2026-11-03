import { Types } from "mongoose";
import { PRIORITIES, Priority } from "../../models/Complaint";
import { SLAPolicy } from "../../models/SLAPolicy";
import { tenantFilter } from "../../utils/tenant";

export interface Policy {
  priority: Priority;
  responseMinutes: number;
  resolutionMinutes: number;
}

// Used until an admin saves their own numbers.
export const DEFAULT_POLICIES: Record<Priority, Omit<Policy, "priority">> = {
  LOW: { responseMinutes: 480, resolutionMinutes: 4320 }, // 8h / 3 days
  MEDIUM: { responseMinutes: 240, resolutionMinutes: 2880 }, // 4h / 2 days
  HIGH: { responseMinutes: 120, resolutionMinutes: 1440 }, // 2h / 1 day
  CRITICAL: { responseMinutes: 30, resolutionMinutes: 480 }, // 30m / 8h
};

// Always returns all four priorities (saved value if present, default otherwise).
export async function listPolicies(organizationId: string): Promise<Policy[]> {
  const saved = await SLAPolicy.find(tenantFilter(organizationId)).lean();
  const byPriority = new Map(saved.map((p) => [p.priority, p]));
  return PRIORITIES.map((priority) => {
    const found = byPriority.get(priority);
    return {
      priority,
      responseMinutes: found?.responseMinutes ?? DEFAULT_POLICIES[priority].responseMinutes,
      resolutionMinutes: found?.resolutionMinutes ?? DEFAULT_POLICIES[priority].resolutionMinutes,
    };
  });
}

export async function getPolicy(organizationId: string, priority: Priority): Promise<Policy> {
  const all = await listPolicies(organizationId);
  return all.find((p) => p.priority === priority)!;
}

export async function savePolicies(organizationId: string, policies: Policy[]): Promise<Policy[]> {
  await Promise.all(
    policies.map((p) =>
      SLAPolicy.updateOne(
        { organizationId: new Types.ObjectId(organizationId), priority: p.priority },
        { $set: { responseMinutes: p.responseMinutes, resolutionMinutes: p.resolutionMinutes } },
        { upsert: true, runValidators: true }
      )
    )
  );
  return listPolicies(organizationId);
}

export function computeDueDates(policy: Policy, from: Date = new Date()) {
  return {
    firstResponseDueAt: new Date(from.getTime() + policy.responseMinutes * 60_000),
    resolutionDueAt: new Date(from.getTime() + policy.resolutionMinutes * 60_000),
  };
}
