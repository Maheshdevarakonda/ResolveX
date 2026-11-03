import express from "express";
import request from "supertest";
import { z } from "zod";
import { createApp } from "../../src/app";
import { errorHandler } from "../../src/middleware/errorHandler";
import { validate } from "../../src/middleware/validate";
import { ApiError } from "../../src/utils/ApiError";
import { asyncHandler } from "../../src/utils/asyncHandler";

describe("App foundation", () => {
  const app = createApp();

  it("GET /api/v1/health returns the standard success shape", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });

  it("returns a 404 JSON error for unknown routes", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Route not found");
  });

  it("sets security headers (helmet)", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await request(app)
      .post("/api/v1/health")
      .set("Content-Type", "application/json")
      .send("{ bad json");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("Error handling and validation", () => {
  const testApp = express();
  testApp.use(express.json());

  testApp.get("/boom", asyncHandler(async () => {
    throw ApiError.forbidden("nope");
  }));
  testApp.get("/crash", asyncHandler(async () => {
    throw new Error("secret internal detail");
  }));
  testApp.post(
    "/validated",
    validate({ body: z.object({ email: z.string().email(), age: z.number().min(18) }) }),
    (_req, res) => {
      res.json({ ok: true });
    }
  );
  testApp.use(errorHandler);

  it("maps ApiError to its status code", async () => {
    const res = await request(testApp).get("/boom");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: "nope" });
  });

  it("turns unexpected errors into a 500", async () => {
    const res = await request(testApp).get("/crash");
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 with field details when validation fails", async () => {
    const res = await request(testApp).post("/validated").send({ email: "not-an-email", age: 10 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
    const fields = res.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["email", "age"]));
  });

  it("passes valid input through", async () => {
    const res = await request(testApp).post("/validated").send({ email: "a@b.com", age: 20 });
    expect(res.status).toBe(200);
  });
});
