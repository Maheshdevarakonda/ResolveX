import { Types } from "mongoose";

// THE tenant-isolation rule of ResolveX:
//   Every query on an organization-owned collection must include organizationId,
//   and that value must come from req.user (the verified token + database),
//   NEVER from req.body, req.query or req.params.
//
// Usage in a service (note the tenant filter is spread LAST so nothing can override it):
//   User.findOne({ _id: userId, ...tenantFilter(orgId) })
export function tenantFilter(organizationId: string): { organizationId: Types.ObjectId } {
  return { organizationId: new Types.ObjectId(organizationId) };
}
