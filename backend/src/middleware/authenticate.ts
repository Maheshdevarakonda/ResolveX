import { Role, User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { verifyAccessToken } from "../utils/tokens";

export interface AuthUser {
  id: string;
  name: string;
  organizationId: string; // the tenant. ALWAYS use this for queries, never a value from req.body
  role: Role;
}

// Adds req.user to Express's Request type.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Checks the "Authorization: Bearer <token>" header, then confirms against the
// database that the user still exists and is active. Role and organization come
// from the database, so deactivating a user or changing a role takes effect
// immediately instead of waiting for the token to expire.
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized();
  }

  const payload = verifyAccessToken(header.slice("Bearer ".length).trim());

  const user = await User.findById(payload.sub).select("organizationId role isActive name").lean();
  if (!user || !user.isActive || String(user.organizationId) !== payload.orgId) {
    throw ApiError.unauthorized("Account is not available");
  }

  req.user = {
    id: String(user._id),
    name: user.name,
    organizationId: String(user.organizationId),
    role: user.role,
  };
  next();
});
