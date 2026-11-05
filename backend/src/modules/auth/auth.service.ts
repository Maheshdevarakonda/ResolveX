import bcrypt from "bcrypt";
import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import { BCRYPT_ROUNDS } from "../../utils/password";
import { Organization } from "../../models/Organization";
import { PasswordReset } from "../../models/PasswordReset";
import { RefreshToken } from "../../models/RefreshToken";
import { Role, SafeUser, User, toSafeUser } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import {
  getTokenExpiry,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/tokens";
import { recordAudit } from "../audit/audit.service";
import { LoginInput, RegisterCustomerInput, RegisterOrgInput } from "./auth.schema";


// Used when the email/organization does not exist, so the "not found" path takes
// about as long as a real password check (prevents timing-based user discovery).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string; // goes into the httpOnly cookie, never into the JSON body
}

interface TokenSubject {
  id: string;
  organizationId: string;
  role: Role;
}

// Creates an access token + a refresh token and records the refresh token's hash.
async function issueTokens(subject: TokenSubject, family: string = crypto.randomUUID()) {
  const accessToken = signAccessToken({
    sub: subject.id,
    orgId: subject.organizationId,
    role: subject.role,
  });
  const refreshToken = signRefreshToken({
    sub: subject.id,
    orgId: subject.organizationId,
    family,
  });

  await RefreshToken.create({
    userId: new Types.ObjectId(subject.id),
    organizationId: new Types.ObjectId(subject.organizationId),
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: getTokenExpiry(refreshToken),
  });

  return { accessToken, refreshToken };
}

// Creates a brand-new organization and its first ADMIN together.
// A transaction makes it all-or-nothing: no organization without an admin.
export async function registerOrganization(input: RegisterOrgInput): Promise<AuthResult> {
  if (await Organization.exists({ slug: input.organizationSlug })) {
    throw ApiError.conflict("This organization URL is already taken");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const admin = await mongoose.connection.transaction(async (session) => {
    const [org] = await Organization.create(
      [{ name: input.organizationName, slug: input.organizationSlug }],
      { session }
    );
    const [user] = await User.create(
      [
        {
          organizationId: org._id,
          name: input.name,
          email: input.email,
          passwordHash,
          role: "ADMIN",
        },
      ],
      { session }
    );
    return user;
  });

  const safeUser = toSafeUser(admin);
  const tokens = await issueTokens(safeUser);
  return { user: safeUser, ...tokens };
}

// Customers always join an existing organization as CUSTOMER.
// The role is fixed here on the server; the client cannot choose it.
export async function registerCustomer(input: RegisterCustomerInput): Promise<AuthResult> {
  const org = await Organization.findOne({ slug: input.organizationSlug, isActive: true });
  if (!org) throw ApiError.notFound("Organization not found");
  if (org.settings?.allowCustomerRegistration === false) {
    throw ApiError.forbidden("This organization is not accepting self-registration");
  }

  const exists = await User.exists({ organizationId: org._id, email: input.email });
  if (exists) throw ApiError.conflict("An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await User.create({
    organizationId: org._id,
    name: input.name,
    email: input.email,
    passwordHash,
    role: "CUSTOMER",
  });

  const safeUser = toSafeUser(user);
  const tokens = await issueTokens(safeUser);
  return { user: safeUser, ...tokens };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const org = await Organization.findOne({ slug: input.organizationSlug, isActive: true });
  const user = org
    ? await User.findOne({ organizationId: org._id, email: input.email }).select("+passwordHash")
    : null;

  // Always run bcrypt.compare, even for unknown users (see DUMMY_HASH).
  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  // Same message for every failure so attackers cannot tell which part was wrong.
  if (!user || !passwordOk) throw ApiError.unauthorized("Invalid credentials");
  if (!user.isActive) throw ApiError.forbidden("This account has been deactivated");

  const safeUser = toSafeUser(user);
  const tokens = await issueTokens(safeUser);
  return { user: safeUser, ...tokens };
}

// Refresh-token rotation: each refresh token works exactly once.
// Using it gives you a NEW pair; the old one is marked revoked.
// If an already-used token shows up again, someone may have stolen it,
// so we revoke every token from that login (the "family").
export async function refreshSession(rawToken: string | undefined): Promise<AuthResult> {
  if (!rawToken) throw ApiError.unauthorized("Refresh token missing");

  const payload = verifyRefreshToken(rawToken); // checks signature and expiry
  const tokenHash = hashToken(rawToken);

  // Atomic "claim": only one request can flip revokedAt from null to a date.
  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } }
  );

  if (!claimed) {
    const known = await RefreshToken.findOne({ tokenHash });
    if (known) {
      await RefreshToken.updateMany(
        { family: known.family, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
    throw ApiError.unauthorized("Refresh token is no longer valid");
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || String(user.organizationId) !== payload.orgId) {
    throw ApiError.unauthorized("Account is not available");
  }

  const safeUser = toSafeUser(user);
  const tokens = await issueTokens(safeUser, claimed.family);
  return { user: safeUser, ...tokens };
}

// Logout ends the whole login session (all tokens in this family).
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const known = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
  if (known) {
    await RefreshToken.updateMany(
      { family: known.family, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }
}

export async function getCurrentUser(userId: string): Promise<SafeUser> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  return toSafeUser(user);
}

// ---------- password reset ----------

const RESET_TOKEN_MINUTES = 30;

// Returns the raw token (or null if no such user). The CONTROLLER never puts it in the HTTP
// response: it is only logged/emailed, so the endpoint cannot be used to discover accounts.
export async function requestPasswordReset(
  organizationSlug: string,
  email: string
): Promise<{ token: string; organizationSlug: string } | null> {
  const org = await Organization.findOne({ slug: organizationSlug, isActive: true });
  if (org?.isDemo) {
    throw ApiError.badRequest("Password reset is disabled on the demo organization");
  }
  const user = org ? await User.findOne({ organizationId: org._id, email, isActive: true }) : null;
  if (!org || !user) return null;

  const token = crypto.randomBytes(32).toString("hex");
  await PasswordReset.create({
    userId: user._id,
    organizationId: org._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000),
  });
  return { token, organizationSlug };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  // Atomic "use once": only one request can flip usedAt from null to a date.
  const reset = await PasswordReset.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } }
  );
  if (!reset) throw ApiError.badRequest("This reset link is invalid or has expired");

  const user = await User.findOneAndUpdate(
    { _id: reset.userId, organizationId: reset.organizationId, isActive: true },
    { $set: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) } },
    { new: true }
  );
  if (!user) throw ApiError.badRequest("This reset link is invalid or has expired");

  // Changing the password signs the user out everywhere.
  await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await recordAudit({
    organizationId: String(user.organizationId),
    actor: { id: String(user._id), name: user.name, role: user.role },
    action: "PASSWORD_RESET",
    entityType: "USER",
    entityId: user._id,
  });
}
