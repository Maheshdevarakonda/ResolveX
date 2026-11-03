import { z } from "zod";
import { ROLES } from "../../models/User";
import { paginationFields } from "../../utils/pagination";
import { objectIdString } from "../../utils/validators";
import { fields } from "../auth/auth.schema";

// Admin creates an employee. The role is NOT accepted from the client: it is always EMPLOYEE.
export const createEmployeeSchema = z.object({
  name: fields.name,
  email: fields.email,
  password: fields.password, // initial password; email invitations can come later
  departmentId: objectIdString.optional(),
});

export const updateUserSchema = z.object({
  name: fields.name.optional(),
  departmentId: objectIdString.nullable().optional(), // null removes the department
  isActive: z.boolean().optional(),
});

// A user editing their own profile can change nothing except their name.
export const updateMeSchema = z.object({
  name: fields.name,
});

export const listUsersQuerySchema = z.object({
  ...paginationFields,
  role: z.enum(ROLES).optional(),
  departmentId: objectIdString.optional(),
  isActive: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  q: z.string().trim().min(1).max(60).optional(), // search in name or email
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
