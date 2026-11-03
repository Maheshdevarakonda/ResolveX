import { z } from "zod";
import { PRIORITIES } from "../../models/Complaint";

const minutes = z.number().int().min(5).max(43200); // 5 minutes to 30 days

export const savePoliciesSchema = z.object({
  policies: z
    .array(
      z
        .object({
          priority: z.enum(PRIORITIES),
          responseMinutes: minutes,
          resolutionMinutes: minutes,
        })
        .refine((p) => p.resolutionMinutes >= p.responseMinutes, {
          message: "Resolution time must be at least the response time",
          path: ["resolutionMinutes"],
        })
    )
    .min(1)
    .max(4)
    .refine((list) => new Set(list.map((p) => p.priority)).size === list.length, {
      message: "Each priority may appear only once",
    }),
});
