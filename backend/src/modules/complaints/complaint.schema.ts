import { z } from "zod";
import { CATEGORIES, PRIORITIES, STATUSES } from "../../models/Complaint";
import { paginationFields } from "../../utils/pagination";
import { objectIdString } from "../../utils/validators";

export const createComplaintSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(150),
  description: z.string().trim().min(10, "Please describe the problem in at least 10 characters").max(5000),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
});

export const listComplaintsQuerySchema = z.object({
  ...paginationFields,
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  departmentId: objectIdString.optional(),
  assignedTo: objectIdString.optional(),
  isEscalated: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  q: z.string().trim().min(1).max(80).optional(), // searches ticket number and title
  sort: z.enum(["newest", "oldest", "due"]).default("newest"),
});

export const assignSchema = z.object({
  employeeId: objectIdString,
  departmentId: objectIdString.optional(),
});

export const statusSchema = z.object({
  status: z.enum(["IN_PROGRESS", "RESOLVED"]),
  note: z.string().trim().max(2000).optional(),
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(5, "Please explain why you are reopening").max(1000),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type ListComplaintsQuery = z.infer<typeof listComplaintsQuerySchema>;
export type AssignInput = z.infer<typeof assignSchema>;
export type StatusInput = z.infer<typeof statusSchema>;
