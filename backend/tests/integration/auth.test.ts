import jwt from "jsonwebtoken";
import request, { Response } from "supertest";
import { createApp } from "../../src/app";
import { RefreshToken } from "../../src/models/RefreshToken";
import { User } from "../../src/models/User";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";

const app = createApp();
const API = "/api/v1/auth";

const orgA = {
  organizationName: "Acme Telecom",
  organizationSlug: "acme-telecom",
  name: "Alice Admin",
  email: "alice@acme.com",
  password: "Password123",
};

function refreshCookie(res: Response): string {
  const cookies = (res.headers["set-cookie"] as unknown as string[]) ?? [];
  const found = cookies.find((c) => c.startsWith("refreshToken="));
  if (!found) throw new Error("refreshToken cookie not set");
  return found.split(";")[0];
}

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearDb);

describe("POST /register-org", () => {
  it("creates the organization and its ADMIN, and logs them in", async () => {
    const res = await request(app).post(`${API}/register-org`).send(orgA);

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("ADMIN");
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) =>
      c.startsWith("refreshToken=")
    );
    expect(cookie).toContain("HttpOnly");
  });

  it("stores a bcrypt hash, never the plain password", async () => {
    await request(app).post(`${API}/register-org`).send(orgA);
    const user = await User.findOne({ email: orgA.email }).select("+passwordHash");
    expect(user?.passwordHash).not.toBe(orgA.password);
    expect(user?.passwordHash.startsWith("$2")).toBe(true);
  });

  it("rejects a duplicate organization slug with 409", async () => {
    await request(app).post(`${API}/register-org`).send(orgA);
    const res = await request(app)
      .post(`${API}/register-org`)
      .send({ ...orgA, email: "other@acme.com" });
    expect(res.status).toBe(409);
  });

  it("rejects a weak password with 400", async () => {
    const res = await request(app)
      .post(`${API}/register-org`)
      .send({ ...orgA, password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });
});

describe("POST /register (customer)", () => {
  beforeEach(async () => {
    await request(app).post(`${API}/register-org`).send(orgA);
  });

  it("creates a CUSTOMER in the organization", async () => {
    const res = await request(app).post(`${API}/register`).send({
      organizationSlug: "acme-telecom",
      name: "Carl Customer",
      email: "carl@mail.com",
      password: "Password123",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("CUSTOMER");
  });

  it("ignores a role sent by the client (cannot self-promote to ADMIN)", async () => {
    const res = await request(app).post(`${API}/register`).send({
      organizationSlug: "acme-telecom",
      name: "Mallory",
      email: "mallory@mail.com",
      password: "Password123",
      role: "ADMIN",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("CUSTOMER");
  });

  it("returns 404 for an unknown organization", async () => {
    const res = await request(app).post(`${API}/register`).send({
      organizationSlug: "no-such-org",
      name: "Carl Customer",
      email: "carl@mail.com",
      password: "Password123",
    });
    expect(res.status).toBe(404);
  });

  it("rejects a duplicate email inside the same organization", async () => {
    const body = {
      organizationSlug: "acme-telecom",
      name: "Carl Customer",
      email: "carl@mail.com",
      password: "Password123",
    };
    await request(app).post(`${API}/register`).send(body);
    const res = await request(app).post(`${API}/register`).send(body);
    expect(res.status).toBe(409);
  });

  it("allows the same email in a different organization", async () => {
    await request(app)
      .post(`${API}/register-org`)
      .send({ ...orgA, organizationSlug: "beta-bank", organizationName: "Beta Bank" });
    const body = { name: "Carl Customer", email: "carl@mail.com", password: "Password123" };
    const a = await request(app).post(`${API}/register`).send({ ...body, organizationSlug: "acme-telecom" });
    const b = await request(app).post(`${API}/register`).send({ ...body, organizationSlug: "beta-bank" });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.user.organizationId).not.toBe(b.body.data.user.organizationId);
  });
});

describe("POST /login", () => {
  beforeEach(async () => {
    await request(app).post(`${API}/register-org`).send(orgA);
  });

  const creds = { organizationSlug: "acme-telecom", email: "alice@acme.com", password: "Password123" };

  it("logs in with valid credentials", async () => {
    const res = await request(app).post(`${API}/login`).send(creds);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toContain("refreshToken=");
  });

  it("returns the same 401 for wrong password, unknown email and unknown organization", async () => {
    const wrongPassword = await request(app).post(`${API}/login`).send({ ...creds, password: "Wrong12345" });
    const unknownEmail = await request(app).post(`${API}/login`).send({ ...creds, email: "ghost@acme.com" });
    const unknownOrg = await request(app).post(`${API}/login`).send({ ...creds, organizationSlug: "ghost-org" });

    for (const res of [wrongPassword, unknownEmail, unknownOrg]) {
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid credentials");
    }
  });

  it("blocks a deactivated user with 403", async () => {
    await User.updateOne({ email: "alice@acme.com" }, { isActive: false });
    const res = await request(app).post(`${API}/login`).send(creds);
    expect(res.status).toBe(403);
  });

  it("validates the request body", async () => {
    const res = await request(app).post(`${API}/login`).send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("GET /me and access-token handling", () => {
  let accessToken: string;

  beforeEach(async () => {
    const res = await request(app).post(`${API}/register-org`).send(orgA);
    accessToken = res.body.data.accessToken;
  });

  it("returns the current user for a valid token", async () => {
    const res = await request(app).get(`${API}/me`).set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("alice@acme.com");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get(`${API}/me`);
    expect(res.status).toBe(401);
  });

  it("returns 401 for a tampered token", async () => {
    const res = await request(app).get(`${API}/me`).set("Authorization", `Bearer ${accessToken}x`);
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
    const expired = jwt.sign(
      { sub: decoded.sub, orgId: decoded.orgId, role: decoded.role },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: -10 }
    );
    const res = await request(app).get(`${API}/me`).set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Access token expired");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
    const forged = jwt.sign(
      { sub: decoded.sub, orgId: decoded.orgId, role: "ADMIN" },
      "a-completely-different-secret-value-1234567890"
    );
    const res = await request(app).get(`${API}/me`).set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it("rejects a valid token once the user is deactivated", async () => {
    await User.updateOne({ email: "alice@acme.com" }, { isActive: false });
    const res = await request(app).get(`${API}/me`).set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
  });
});

describe("Refresh-token rotation and logout", () => {
  let cookie: string;

  beforeEach(async () => {
    const res = await request(app).post(`${API}/register-org`).send(orgA);
    cookie = refreshCookie(res);
  });

  it("issues a new access token and a different refresh token", async () => {
    const res = await request(app).post(`${API}/refresh`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).not.toBe(cookie);
  });

  it("returns 401 when the cookie is missing", async () => {
    const res = await request(app).post(`${API}/refresh`);
    expect(res.status).toBe(401);
  });

  it("detects reuse of an old refresh token and revokes the whole session", async () => {
    const first = await request(app).post(`${API}/refresh`).set("Cookie", cookie);
    const newCookie = refreshCookie(first);

    const reuse = await request(app).post(`${API}/refresh`).set("Cookie", cookie);
    expect(reuse.status).toBe(401);

    // The newer token from the same family must now be dead too.
    const afterReuse = await request(app).post(`${API}/refresh`).set("Cookie", newCookie);
    expect(afterReuse.status).toBe(401);
  });

  it("logout revokes the session", async () => {
    const out = await request(app).post(`${API}/logout`).set("Cookie", cookie);
    expect(out.status).toBe(200);

    const res = await request(app).post(`${API}/refresh`).set("Cookie", cookie);
    expect(res.status).toBe(401);
  });

  it("stores refresh tokens hashed, not in plain text", async () => {
    const stored = await RefreshToken.find();
    const rawToken = cookie.replace("refreshToken=", "");
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((t) => t.tokenHash !== rawToken)).toBe(true);
  });
});
