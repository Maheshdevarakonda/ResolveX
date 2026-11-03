import { FilterQuery, Types } from "mongoose";
import { Department } from "../../models/Department";
import { RefreshToken } from "../../models/RefreshToken";
import { IUser, SafeUser, User, toSafeUser } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { PaginationMeta, buildMeta } from "../../utils/pagination";
import { hashPassword } from "../../utils/password";
import { tenantFilter } from "../../utils/tenant";
import { escapeRegex } from "../../utils/validators";
import { CreateEmployeeInput, ListUsersQuery, UpdateMeInput, UpdateUserInput } from "./user.schema";

// A department id sent by the client is only accepted if it belongs to the SAME organization.
async function assertDepartmentInTenant(organizationId: string, departmentId: string): Promise<void> {
  const exists = await Department.exists({ _id: departmentId, ...tenantFilter(organizationId) });
  if (!exists) throw ApiError.notFound("Department not found");
}

export async function createEmployee(
  organizationId: string,
  input: CreateEmployeeInput
): Promise<SafeUser> {
  const taken = await User.exists({ email: input.email, ...tenantFilter(organizationId) });
  if (taken) throw ApiError.conflict("An account with this email already exists");

  if (input.departmentId) await assertDepartmentInTenant(organizationId, input.departmentId);

  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: "EMPLOYEE", // fixed by the server
    ...(input.departmentId ? { departmentId: new Types.ObjectId(input.departmentId) } : {}),
    ...tenantFilter(organizationId),
  });
  return toSafeUser(user);
}

export async function listUsers(
  organizationId: string,
  query: ListUsersQuery
): Promise<{ items: SafeUser[]; meta: PaginationMeta }> {
  const filter: FilterQuery<IUser> = { ...tenantFilter(organizationId) };
  if (query.role) filter.role = query.role;
  if (query.departmentId) filter.departmentId = new Types.ObjectId(query.departmentId);
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    User.countDocuments(filter),
  ]);

  return { items: users.map(toSafeUser), meta: buildMeta(query.page, query.limit, total) };
}

export async function getUser(organizationId: string, id: string): Promise<SafeUser> {
  const user = await User.findOne({ _id: id, ...tenantFilter(organizationId) });
  if (!user) throw ApiError.notFound("User not found");
  return toSafeUser(user);
}

export async function updateUser(
  organizationId: string,
  actorId: string,
  id: string,
  input: UpdateUserInput
): Promise<SafeUser> {
  if (input.name === undefined && input.departmentId === undefined && input.isActive === undefined) {
    throw ApiError.badRequest("No valid fields to update");
  }

  const user = await User.findOne({ _id: id, ...tenantFilter(organizationId) });
  if (!user) throw ApiError.notFound("User not found");

  if (input.isActive === false && String(user._id) === actorId) {
    throw ApiError.badRequest("You cannot deactivate your own account");
  }

  if (input.name !== undefined) user.name = input.name;

  if (input.departmentId !== undefined) {
    if (user.role !== "EMPLOYEE") {
      throw ApiError.badRequest("Only employees can belong to a department");
    }
    if (input.departmentId === null) {
      user.departmentId = undefined;
    } else {
      await assertDepartmentInTenant(organizationId, input.departmentId);
      user.departmentId = new Types.ObjectId(input.departmentId);
    }
  }

  if (input.isActive !== undefined) user.isActive = input.isActive;

  await user.save();

  // A deactivated user must lose every active login session immediately.
  if (input.isActive === false) {
    await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  }

  return toSafeUser(user);
}

// Self-service profile edit. Only `name` is writable, whatever the client sends.
export async function updateMe(
  organizationId: string,
  userId: string,
  input: UpdateMeInput
): Promise<SafeUser> {
  const user = await User.findOneAndUpdate(
    { _id: userId, ...tenantFilter(organizationId) },
    { $set: { name: input.name } },
    { new: true, runValidators: true }
  );
  if (!user) throw ApiError.notFound("User not found");
  return toSafeUser(user);
}
