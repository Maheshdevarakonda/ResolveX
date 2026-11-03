import { Response } from "express";

// Every successful response has the same shape: { success, message, data, meta? }
// meta is used for pagination info later.
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "OK",
  statusCode = 200,
  meta?: Record<string, unknown>
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}
