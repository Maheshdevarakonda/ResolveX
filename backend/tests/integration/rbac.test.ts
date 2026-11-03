import express from "express";
import request from "supertest";
import { createApp } from "../../src/app";
import { authenticate } from "../../src/middleware/authenticate";
import { authorize } from "../../src/middleware/authorize";
import { errorHandler } from "../../src/middleware/errorHandler";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";

const app = createApp();

// A tiny app with routes protected the same way real ones will be.
const guarded = express();
guarded.get("/admin-only", authenticate, authorize("ADMIN"), (req, res) => {
  res.json({ ok: true, role: req.user!.role });
});
guarded.get("/staff", authenticate, authorize("ADMIN", "EMPLOYEE"), (_req, res) => {
  res.json({ ok: true });
});
guarded.use(errorHandler);

async function registerAdmin(slug: string) {
  const res = await request(app).post("/api/v1/auth/register-org").send({
    organizationName: `Org ${slug}`,
    organizationSlug: slug,
    name: "Admin User",
    email: `admin@${slug}.com`,
    password: "Password123",
  });
  return res.body.data.accessToken as string;
}

async function registerCustomer(slug: string) {
  const res = await request(app).post("/api/v1/auth/register").send({
    organizationSlug: slug,
    name: "Customer User",
    email: `customer@${slug}.com`,
    password: "Password123",
  });
  return res.body.data.accessToken as string;
}

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearDb);

describe("Role-based access control", () => {
  it("returns 401 when no token is sent", async () => {
    const res = await request(guarded).get("/admin-only");
    expect(res.status).toBe(401);
  });

  it("allows an ADMIN on an admin-only route", async () => {
    const token = await registerAdmin("acme");
    const res = await request(guarded).get("/admin-only").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("ADMIN");
  });

  it("forbids a CUSTOMER on an admin-only route with 403", async () => {
    await registerAdmin("acme");
    const token = await registerCustomer("acme");
    const res = await request(guarded).get("/admin-only").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("forbids a CUSTOMER on a staff route with 403", async () => {
    await registerAdmin("acme");
    const token = await registerCustomer("acme");
    const res = await request(guarded).get("/staff").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("allows an ADMIN on a staff route", async () => {
    const token = await registerAdmin("acme");
    const res = await request(guarded).get("/staff").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
