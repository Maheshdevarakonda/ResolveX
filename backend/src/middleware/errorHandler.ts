import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { isProduction } from "../config/env";

// Runs when no route matched.
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// The ONE place where every error becomes a response.
// Express recognises an error handler by its 4 parameters, so _next must stay.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let message = "Internal server error";
  let errors: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation failed";
    errors = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
  } else if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 5 MB)" : err.code === "LIMIT_FILE_COUNT" ? "Too many files" : "Invalid file upload";
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  } else if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    statusCode = 409;
    message = "Duplicate value: resource already exists";
  } else if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    message = "Malformed JSON in request body";
  }

  if (statusCode >= 500) {
    logger.error("Unhandled error", err);
    // Never leak internal details to clients in production.
    if (!isProduction && err instanceof Error) message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
}
