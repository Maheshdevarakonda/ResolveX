import { HydratedDocument } from "mongoose";
import { Department, IDepartment } from "../../models/Department";
import { User } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { tenantFilter } from "../../utils/tenant";
import { CreateDepartmentInput, UpdateDepartmentInput } from "./department.schema";

export interface DepartmentDto {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
}

function toDto(d: HydratedDocument<IDepartment>): DepartmentDto {
  return {
    id: String(d._id),
    name: d.name,
    ...(d.description ? { description: d.description } : {}),
    createdAt: d.createdAt,
  };
}

// Same collation as the unique index, so "billing" finds "Billing".
const caseInsensitive = { locale: "en", strength: 2 } as const;

// An organization has a handful of departments, so we return them all (sorted) without pagination.
export async function listDepartments(organizationId: string): Promise<DepartmentDto[]> {
  const departments = await Department.find(tenantFilter(organizationId))
    .sort({ name: 1 })
    .collation(caseInsensitive)
    .limit(200);
  return departments.map(toDto);
}

export async function createDepartment(
  organizationId: string,
  input: CreateDepartmentInput
): Promise<DepartmentDto> {
  const taken = await Department.exists({ name: input.name, ...tenantFilter(organizationId) }).collation(
    caseInsensitive
  );
  if (taken) throw ApiError.conflict("A department with this name already exists");

  const department = await Department.create({ ...input, ...tenantFilter(organizationId) });
  return toDto(department);
}

export async function updateDepartment(
  organizationId: string,
  id: string,
  input: UpdateDepartmentInput
): Promise<DepartmentDto> {
  if (input.name === undefined && input.description === undefined) {
    throw ApiError.badRequest("No valid fields to update");
  }

  if (input.name) {
    const clash = await Department.exists({
      name: input.name,
      _id: { $ne: id },
      ...tenantFilter(organizationId),
    }).collation(caseInsensitive);
    if (clash) throw ApiError.conflict("A department with this name already exists");
  }

  const department = await Department.findOneAndUpdate(
    { _id: id, ...tenantFilter(organizationId) },
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!department) throw ApiError.notFound("Department not found");
  return toDto(department);
}

export async function deleteDepartment(organizationId: string, id: string): Promise<void> {
  // Do not orphan employees. (Phase 5b will also check for complaints.)
  const inUse = await User.exists({ departmentId: id, ...tenantFilter(organizationId) });
  if (inUse) {
    throw ApiError.conflict("Department still has employees. Reassign them first");
  }

  const result = await Department.deleteOne({ _id: id, ...tenantFilter(organizationId) });
  if (result.deletedCount === 0) throw ApiError.notFound("Department not found");
}
