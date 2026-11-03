import request from "supertest";
import { AuditLog } from "../../src/models/AuditLog";
import { Notification } from "../../src/models/Notification";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";
import { Tenant, app, bearer, createComplaint, createEmployee, createTenant, resolveComplaint } from "../helpers/tenants";

const C = "/api/v1/complaints";
let a: Tenant;
let b: Tenant;
let eve: { id: string; token: string };
let task: { id: string; ticketNo: string };

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearDb();
  a = await createTenant("org-a");
  b = await createTenant("org-b");
  eve = await createEmployee(a, "eve@org-a.com");
  task = await createComplaint(a.customerToken);
  await request(app).patch(`${C}/${task.id}/assign`).set(bearer(a.adminToken)).send({ employeeId: eve.id });
});

describe("Comments", () => {
  it("customer and assigned staff can converse", async () => {
    const c1 = await request(app).post(`${C}/${task.id}/comments`).set(bearer(a.customerToken)).send({ body: "Any update?" });
    const c2 = await request(app).post(`${C}/${task.id}/comments`).set(bearer(eve.token)).send({ body: "Looking into it now" });
    expect(c1.status).toBe(201);
    expect(c2.status).toBe(201);
    const list = await request(app).get(`${C}/${task.id}/comments`).set(bearer(a.customerToken));
    expect(list.body.data.map((c: { body: string }) => c.body)).toEqual(["Any update?", "Looking into it now"]);
  });

  it("hides internal notes from customers and ignores isInternal from customers", async () => {
    await request(app).post(`${C}/${task.id}/comments`).set(bearer(eve.token)).send({ body: "Customer is rude, escalate", isInternal: true });
    const sneaky = await request(app)
      .post(`${C}/${task.id}/comments`)
      .set(bearer(a.customerToken))
      .send({ body: "Trying to hide this", isInternal: true });
    expect(sneaky.body.data.comment.isInternal).toBe(false);

    const asCustomer = await request(app).get(`${C}/${task.id}/comments`).set(bearer(a.customerToken));
    const asStaff = await request(app).get(`${C}/${task.id}/comments`).set(bearer(eve.token));
    expect(asCustomer.body.data.map((c: { body: string }) => c.body)).toEqual(["Trying to hide this"]);
    expect(asStaff.body.data).toHaveLength(2);
  });

  it("a staff reply sets the first response time", async () => {
    await request(app).post(`${C}/${task.id}/comments`).set(bearer(eve.token)).send({ body: "On it" });
    const res = await request(app).get(`${C}/${task.id}`).set(bearer(a.adminToken));
    expect(res.body.data.complaint.firstRespondedAt).not.toBeNull();
  });

  it("rejects empty comments and comments on closed complaints", async () => {
    const empty = await request(app).post(`${C}/${task.id}/comments`).set(bearer(a.customerToken)).send({ body: "   " });
    expect(empty.status).toBe(400);

    await resolveComplaint(a, task.id, eve);
    await request(app).post(`${C}/${task.id}/close`).set(bearer(a.customerToken));
    const closed = await request(app).post(`${C}/${task.id}/comments`).set(bearer(a.customerToken)).send({ body: "One more thing" });
    expect(closed.status).toBe(409);
  });

  it("another organization's admin cannot read or write comments", async () => {
    const read = await request(app).get(`${C}/${task.id}/comments`).set(bearer(b.adminToken));
    const write = await request(app).post(`${C}/${task.id}/comments`).set(bearer(b.adminToken)).send({ body: "Hello" });
    expect(read.status).toBe(404);
    expect(write.status).toBe(404);
  });
});

describe("Notifications", () => {
  it("notifies the right people when a complaint is created, assigned and updated", async () => {
    const adminList = await request(app).get("/api/v1/notifications").set(bearer(a.adminToken));
    expect(adminList.body.data.some((n: { type: string }) => n.type === "COMPLAINT_CREATED")).toBe(true);

    const eveList = await request(app).get("/api/v1/notifications").set(bearer(eve.token));
    expect(eveList.body.data.some((n: { type: string }) => n.type === "ASSIGNED")).toBe(true);

    await request(app).patch(`${C}/${task.id}/status`).set(bearer(eve.token)).send({ status: "IN_PROGRESS" });
    const customerList = await request(app).get("/api/v1/notifications").set(bearer(a.customerToken));
    expect(customerList.body.data.some((n: { type: string }) => n.type === "STATUS_CHANGED")).toBe(true);
  });

  it("does not notify the person who caused the event", async () => {
    const before = await Notification.countDocuments({ userId: a.customerId });
    await request(app).post(`${C}/${task.id}/comments`).set(bearer(a.customerToken)).send({ body: "Any update?" });
    expect(await Notification.countDocuments({ userId: a.customerId })).toBe(before);
  });

  it("marks one or all notifications read, and users cannot touch others' notifications", async () => {
    const list = await request(app).get("/api/v1/notifications").set(bearer(eve.token));
    const id = list.body.data[0].id;
    expect(list.body.meta.unread).toBeGreaterThan(0);

    const foreign = await request(app).patch(`/api/v1/notifications/${id}/read`).set(bearer(a.adminToken));
    expect(foreign.status).toBe(404);

    const one = await request(app).patch(`/api/v1/notifications/${id}/read`).set(bearer(eve.token));
    expect(one.body.data.notification.isRead).toBe(true);

    await request(app).patch("/api/v1/notifications/read-all").set(bearer(eve.token));
    const after = await request(app).get("/api/v1/notifications?unread=true").set(bearer(eve.token));
    expect(after.body.data).toHaveLength(0);
  });
});

describe("Feedback", () => {
  it("requires a resolved complaint, accepts one rating, and rejects a second", async () => {
    const early = await request(app).post(`${C}/${task.id}/feedback`).set(bearer(a.customerToken)).send({ rating: 5 });
    expect(early.status).toBe(409);

    await resolveComplaint(a, task.id, eve);
    const ok = await request(app).post(`${C}/${task.id}/feedback`).set(bearer(a.customerToken)).send({ rating: 4, comment: "Quick fix" });
    const again = await request(app).post(`${C}/${task.id}/feedback`).set(bearer(a.customerToken)).send({ rating: 1 });
    const invalid = await request(app).post(`${C}/${task.id}/feedback`).set(bearer(a.customerToken)).send({ rating: 9 });
    expect(ok.status).toBe(201);
    expect(again.status).toBe(409);
    expect(invalid.status).toBe(400);

    const list = await request(app).get("/api/v1/feedback").set(bearer(a.adminToken));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.averageRating).toBe(4);
    const forbidden = await request(app).get("/api/v1/feedback").set(bearer(a.customerToken));
    expect(forbidden.status).toBe(403);
  });
});

describe("Attachments", () => {
  it("answers 503 when file storage is not configured (as in tests)", async () => {
    const res = await request(app)
      .post(`${C}/${task.id}/attachments`)
      .set(bearer(a.customerToken))
      .attach("files", Buffer.from("fake image"), { filename: "photo.png", contentType: "image/png" });
    expect(res.status).toBe(503);
  });

  it("rejects disallowed file types", async () => {
    const res = await request(app)
      .post(`${C}/${task.id}/attachments`)
      .set(bearer(a.customerToken))
      .attach("files", Buffer.from("MZ"), { filename: "virus.exe", contentType: "application/x-msdownload" });
    expect(res.status).toBe(400);
  });
});

describe("Audit logs", () => {
  it("records who did what, and only admins of the same organization can read them", async () => {
    await request(app).patch(`${C}/${task.id}/status`).set(bearer(eve.token)).send({ status: "IN_PROGRESS" });

    const res = await request(app).get("/api/v1/audit-logs").set(bearer(a.adminToken));
    expect(res.status).toBe(200);
    const actions = res.body.data.map((l: { action: string }) => l.action);
    expect(actions).toEqual(expect.arrayContaining(["COMPLAINT_CREATED", "COMPLAINT_ASSIGNED", "COMPLAINT_STATUS_CHANGED"]));
    const statusLog = res.body.data.find((l: { action: string }) => l.action === "COMPLAINT_STATUS_CHANGED");
    expect(statusLog.actorName).toBe("Eve Employee");
    expect(statusLog.changes).toEqual({ before: { status: "ASSIGNED" }, after: { status: "IN_PROGRESS" } });
    expect(statusLog.complaint.ticketNo).toBe(task.ticketNo);

    const other = await request(app).get("/api/v1/audit-logs").set(bearer(b.adminToken));
    expect(other.body.data.some((l: { action: string }) => l.action === "COMPLAINT_CREATED")).toBe(false);
    expect(await AuditLog.countDocuments({ organizationId: b.organizationId, action: "COMPLAINT_CREATED" })).toBe(0);

    const customer = await request(app).get("/api/v1/audit-logs").set(bearer(a.customerToken));
    expect(customer.status).toBe(403);
  });

  it("filters by complaint and action", async () => {
    const res = await request(app).get(`/api/v1/audit-logs?complaintId=${task.id}&action=COMPLAINT_ASSIGNED`).set(bearer(a.adminToken));
    expect(res.body.data).toHaveLength(1);
  });

  it("records admin actions on users, departments and settings", async () => {
    await request(app).post("/api/v1/departments").set(bearer(a.adminToken)).send({ name: "Billing" });
    await request(app).patch("/api/v1/organization").set(bearer(a.adminToken)).send({ name: "Renamed Org" });
    await request(app).patch(`/api/v1/users/${eve.id}`).set(bearer(a.adminToken)).send({ isActive: false });
    const res = await request(app).get("/api/v1/audit-logs?limit=100").set(bearer(a.adminToken));
    const actions = res.body.data.map((l: { action: string }) => l.action);
    expect(actions).toEqual(expect.arrayContaining(["DEPARTMENT_CREATED", "ORGANIZATION_UPDATED", "USER_DEACTIVATED", "USER_CREATED"]));
  });
});
