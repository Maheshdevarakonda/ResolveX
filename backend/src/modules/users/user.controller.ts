import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { auditFromRequest } from "../audit/audit.service";
import * as service from "./user.service";
import { ListUsersQuery } from "./user.schema";

export const createEmployee = asyncHandler(async (req, res) => {
  const user = await service.createEmployee(req.user!.organizationId, req.body);
  await auditFromRequest(req, {
    action: "USER_CREATED",
    entityType: "USER",
    entityId: user.id,
    changes: { after: { email: user.email, role: user.role } },
  });
  sendSuccess(res, { user }, "Employee created", 201);
});

export const list = asyncHandler(async (req, res) => {
  // validate() has already parsed and defaulted the query, so this cast is safe.
  const { items, meta } = await service.listUsers(
    req.user!.organizationId,
    req.query as unknown as ListUsersQuery
  );
  sendSuccess(res, items, "OK", 200, { ...meta });
});

export const get = asyncHandler(async (req, res) => {
  const user = await service.getUser(req.user!.organizationId, req.params.id);
  sendSuccess(res, { user });
});

export const update = asyncHandler(async (req, res) => {
  const user = await service.updateUser(req.user!.organizationId, req.user!.id, req.params.id, req.body);
  const action =
    req.body.isActive === false ? "USER_DEACTIVATED" : req.body.isActive === true ? "USER_ACTIVATED" : "USER_UPDATED";
  await auditFromRequest(req, { action, entityType: "USER", entityId: user.id, changes: { after: req.body } });
  sendSuccess(res, { user }, "User updated");
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await service.updateMe(req.user!.organizationId, req.user!.id, req.body);
  sendSuccess(res, { user }, "Profile updated");
});
