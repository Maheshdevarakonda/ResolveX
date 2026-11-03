import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { auditFromRequest } from "../audit/audit.service";
import * as service from "./department.service";

export const list = asyncHandler(async (req, res) => {
  const departments = await service.listDepartments(req.user!.organizationId);
  sendSuccess(res, departments);
});

export const create = asyncHandler(async (req, res) => {
  const department = await service.createDepartment(req.user!.organizationId, req.body);
  await auditFromRequest(req, {
    action: "DEPARTMENT_CREATED",
    entityType: "DEPARTMENT",
    entityId: department.id,
    changes: { after: { name: department.name } },
  });
  sendSuccess(res, { department }, "Department created", 201);
});

export const update = asyncHandler(async (req, res) => {
  const department = await service.updateDepartment(req.user!.organizationId, req.params.id, req.body);
  await auditFromRequest(req, {
    action: "DEPARTMENT_UPDATED",
    entityType: "DEPARTMENT",
    entityId: department.id,
    changes: { after: req.body },
  });
  sendSuccess(res, { department }, "Department updated");
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteDepartment(req.user!.organizationId, req.params.id);
  await auditFromRequest(req, { action: "DEPARTMENT_DELETED", entityType: "DEPARTMENT", entityId: req.params.id });
  sendSuccess(res, null, "Department deleted");
});
