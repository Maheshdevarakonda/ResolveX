import { CookieOptions, Request, Response } from "express";
import { isProduction } from "../../config/env";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { Role } from "../../models/User";
import * as demoService from "./demo.service";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = "refreshToken";

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/api/v1/auth",
    maxAge: SEVEN_DAYS_MS,
  };
}

export const createDemoSession = asyncHandler(async (req: Request, res: Response) => {
  const role = (req.body?.role as Role) || "CUSTOMER";
  const validRoles: Role[] = ["CUSTOMER", "EMPLOYEE", "ADMIN"];
  const selectedRole = validRoles.includes(role) ? role : "CUSTOMER";

  const result = await demoService.getDemoSession(selectedRole);
  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());

  return sendSuccess(
    res,
    {
      user: result.user,
      accessToken: result.accessToken,
      organization: result.organization,
    },
    `Demo session initialized as ${selectedRole}`
  );
});

export const resetDemo = asyncHandler(async (_req: Request, res: Response) => {
  const result = await demoService.resetDemoSession();
  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());

  return sendSuccess(
    res,
    {
      user: result.user,
      accessToken: result.accessToken,
      organization: result.organization,
    },
    "Demo environment reset to baseline sample data"
  );
});

