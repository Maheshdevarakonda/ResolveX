import { z } from "zod";

// A MongoDB ObjectId is 24 hex characters. Checking it up front gives a clean 400
// instead of a database CastError.
export const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const idParamsSchema = z.object({ id: objectIdString });

// Escapes text so a search term like "a.*" is treated literally, not as a regex.
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
