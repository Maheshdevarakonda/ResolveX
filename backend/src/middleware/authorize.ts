import { RequestHandler } from "express";
import { Role } from "../models/User";
import { ApiError } from "../utils/ApiError";

// Role-Based Access Control. Always placed AFTER authenticate.
// Example:  router.get("/audit-logs", authenticate, authorize("ADMIN"), controller)
export const authorize =
  (...allowedRoles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
