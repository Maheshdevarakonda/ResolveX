import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { auditFromRequest } from "../audit/audit.service";
import * as service from "./organization.service";

// req.user is guaranteed by the authenticate middleware on the router.
export const get = asyncHandler(async (req, res) => {
  const organization = await service.getOrganization(req.user!.organizationId);
  sendSuccess(res, { organization });
});

export const update = asyncHandler(async (req, res) => {
  const before = await service.getOrganization(req.user!.organizationId);
  const organization = await service.updateOrganization(req.user!.organizationId, req.body);
  await auditFromRequest(req, {
    action: "ORGANIZATION_UPDATED",
    entityType: "ORGANIZATION",
    entityId: organization.id,
    changes: { before: { name: before.name, settings: before.settings }, after: { name: organization.name, settings: organization.settings } },
  });
  sendSuccess(res, { organization }, "Organization updated");
});

export const listMembers = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listMembers(
    req.user!.organizationId,
    req.query as unknown as Parameters<typeof service.listMembers>[1]
  );
  sendSuccess(res, items, "OK", 200, { ...meta });
});

export const getMember = asyncHandler(async (req, res) => {
  const user = await service.getMember(req.user!.organizationId, req.params.userId);
  sendSuccess(res, { user });
});
