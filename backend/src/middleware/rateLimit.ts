import rateLimit from "express-rate-limit";
import { isTest } from "../config/env";

const limitMessage = (message: string) => ({ success: false, message });

// General limit for the whole API.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: limitMessage("Too many requests, please try again later"),
});

// Much stricter limit for login / forgot-password (brute-force protection).
// Used in Phase 3.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: limitMessage("Too many authentication attempts, please try again later"),
});
