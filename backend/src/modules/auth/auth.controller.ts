import { CookieOptions, Response } from "express";
import { env, isProduction } from "../../config/env";
import { logger } from "../../utils/logger";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import * as authService from "./auth.service";

export const REFRESH_COOKIE = "refreshToken";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// httpOnly: JavaScript in the browser cannot read the cookie (protects against XSS).
// secure + sameSite "none" in production because Vercel (frontend) and Render (backend)
// are different sites; browsers require "secure" whenever sameSite is "none".
// path: the cookie is only sent to the auth routes, not to every API call.
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/api/v1/auth",
    maxAge: SEVEN_DAYS_MS,
  };
}

function sendAuth(res: Response, result: authService.AuthResult, message: string, status = 200) {
  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
  return sendSuccess(res, { user: result.user, accessToken: result.accessToken }, message, status);
}

export const registerOrg = asyncHandler(async (req, res) => {
  const result = await authService.registerOrganization(req.body);
  sendAuth(res, result, "Organization registered", 201);
});

export const registerCustomer = asyncHandler(async (req, res) => {
  const result = await authService.registerCustomer(req.body);
  sendAuth(res, result, "Account created", 201);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendAuth(res, result, "Logged in");
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refreshSession(req.cookies?.[REFRESH_COOKIE]);
  sendAuth(res, result, "Session refreshed");
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  // Options must match the ones used to set the cookie, or the browser will not clear it.
  const { maxAge: _ignored, ...clearOptions } = cookieOptions();
  res.clearCookie(REFRESH_COOKIE, clearOptions);
  sendSuccess(res, null, "Logged out");
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user!.id);
  sendSuccess(res, { user });
});

// Always answers 200 with the same message, whether or not the account exists.
// There is no email provider yet: the reset link is written to the server log (see docs/DEPLOYMENT.md).
export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.organizationSlug, req.body.email);
  if (result) {
    const link = `${env.CLIENT_URL}/reset-password?token=${result.token}`;
    logger.info(`Password reset link for ${req.body.email} (${result.organizationSlug}): ${link}`);
  }
  sendSuccess(res, null, "If that account exists, a reset link has been sent");
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  sendSuccess(res, null, "Password updated. Please log in");
});
