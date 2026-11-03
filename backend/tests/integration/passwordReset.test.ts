import request from "supertest";
import { PasswordReset } from "../../src/models/PasswordReset";
import { RefreshToken } from "../../src/models/RefreshToken";
import { requestPasswordReset } from "../../src/modules/auth/auth.service";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";
import { Tenant, app, bearer, createTenant } from "../helpers/tenants";

const AUTH = "/api/v1/auth";
let a: Tenant;

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearDb();
  a = await createTenant("org-a");
});

describe("Forgot / reset password", () => {
  it("answers the same way for known and unknown accounts (no account discovery)", async () => {
    const known = await request(app).post(`${AUTH}/forgot-password`).send({ organizationSlug: "org-a", email: "admin@org-a.com" });
    const unknown = await request(app).post(`${AUTH}/forgot-password`).send({ organizationSlug: "org-a", email: "ghost@org-a.com" });
    const noOrg = await request(app).post(`${AUTH}/forgot-password`).send({ organizationSlug: "nope-org", email: "ghost@org-a.com" });
    for (const res of [known, unknown, noOrg]) {
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("If that account exists, a reset link has been sent");
      expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    }
    expect(await PasswordReset.countDocuments()).toBe(1);
  });

  it("resets the password once, signs the user out everywhere, and the old password stops working", async () => {
    const issued = await requestPasswordReset("org-a", "admin@org-a.com");
    const reset = await request(app).post(`${AUTH}/reset-password`).send({ token: issued!.token, password: "NewPassword456" });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app).post(`${AUTH}/login`).send({ organizationSlug: "org-a", email: "admin@org-a.com", password: "Password123" });
    const newLogin = await request(app).post(`${AUTH}/login`).send({ organizationSlug: "org-a", email: "admin@org-a.com", password: "NewPassword456" });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);

    // Sessions that existed before the reset were revoked (the new login created a fresh one).
    expect(await RefreshToken.countDocuments({ userId: a.adminId, revokedAt: null })).toBe(1);

    const reuse = await request(app).post(`${AUTH}/reset-password`).send({ token: issued!.token, password: "AnotherPass789" });
    expect(reuse.status).toBe(400);
  });

  it("rejects expired and invalid tokens, and weak new passwords", async () => {
    const issued = await requestPasswordReset("org-a", "admin@org-a.com");
    await PasswordReset.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const expired = await request(app).post(`${AUTH}/reset-password`).send({ token: issued!.token, password: "NewPassword456" });
    const garbage = await request(app).post(`${AUTH}/reset-password`).send({ token: "x".repeat(64), password: "NewPassword456" });
    const weak = await request(app).post(`${AUTH}/reset-password`).send({ token: issued!.token, password: "short" });
    expect(expired.status).toBe(400);
    expect(garbage.status).toBe(400);
    expect(weak.status).toBe(400);
  });

  it("does not issue tokens for deactivated users", async () => {
    await request(app).patch(`/api/v1/users/${a.customerId}`).set(bearer(a.adminToken)).send({ isActive: false });
    expect(await requestPasswordReset("org-a", "customer@org-a.com")).toBeNull();
  });
});
