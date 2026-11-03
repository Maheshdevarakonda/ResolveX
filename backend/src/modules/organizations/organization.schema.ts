import { z } from "zod";
import { ROLES } from "../../models/User";
import { paginationFields } from "../../utils/pagination";

// Note: slug is deliberately NOT editable (it is part of login URLs).
export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  settings: z
    .object({
      allowCustomerRegistration: z.boolean().optional(),
      reopenWindowDays: z.number().int().min(1).max(90).optional(),
    })
    .optional(),
});

// Any organizationId in the query string is stripped by Zod: tenant never comes from the client.
export const listMembersQuerySchema = z.object({
  ...paginationFields,
  role: z.enum(ROLES).optional(),
});

export const memberParamsSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user id"),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
