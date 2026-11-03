import crypto from "crypto";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "../models/User";
import { ApiError } from "./ApiError";

export interface AccessTokenPayload {
  sub: string; // user id
  orgId: string; // organization (tenant) id
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  orgId: string;
  family: string;
}

// Short-lived token sent in the Authorization header on every API call.
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

// Long-lived token kept in an httpOnly cookie, used only to get a new access token.
// jwtid gives every refresh token a unique value, so two tokens are never identical.
export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    jwtid: crypto.randomUUID(),
  });
}

function verifyToken<T extends object>(token: string, secret: string, label: string): T & JwtPayload {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string") throw new Error("unexpected token payload");
    return decoded as T & JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized(`${label} expired`);
    }
    throw ApiError.unauthorized(`Invalid ${label.toLowerCase()}`);
  }
}

export function verifyAccessToken(token: string): AccessTokenPayload & JwtPayload {
  return verifyToken<AccessTokenPayload>(token, env.JWT_ACCESS_SECRET, "Access token");
}

export function verifyRefreshToken(token: string): RefreshTokenPayload & JwtPayload {
  return verifyToken<RefreshTokenPayload>(token, env.JWT_REFRESH_SECRET, "Refresh token");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Expiry date (from the token's own `exp` claim) to store in the database.
export function getTokenExpiry(token: string): Date {
  const decoded = jwt.decode(token) as JwtPayload | null;
  if (!decoded?.exp) throw new Error("Token has no expiry");
  return new Date(decoded.exp * 1000);
}
