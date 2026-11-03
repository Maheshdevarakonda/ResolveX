import request from "supertest";
import { Complaint } from "../../src/models/Complaint";
import { Organization } from "../../src/models/Organization";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";
import {
  Tenant,
  app,
  bearer,
  complaintBody,
  createComplaint,
  createEmployee,
  createTenant,
  resolveComplaint,
} from "../helpers/tenants";

const C = "/api/v1/complaints";
let a: Tenant;
let b: Tenant;
let eve: { id: string; token: string };

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearDb();
  a = await createTenant("org-a");
  b = await createTenant("org-b");
  eve = await createEmployee(a, "eve@org-a.com");
});

describe("Creating complaints", () => {
  it("lets a customer create a complaint with a ticket number and SLA deadlines", async () => {
    const res = await request(app).post(C).set(bearer(a.customerToken)).send(complaintBody);
    expect(res.status).toBe(201);
    const c = res.body.data.complaint;
    expect(c.ticketNo).toBe("RX-000001");
    expect(c.status).toBe("OPEN");
    expect(new Date(c.resolutionDueAt).getTime()).toBeGreaterThan(Date.now());
    expect(c.statusHistory).toHaveLength(1);
  });

  it("numbers tickets per organization", async () => {
    await createComplaint(a.customerToken);
    const second = await createComplaint(a.customerToken);
    const other = await createComplaint(b.customerToken);
    expect(second.ticketNo).toBe("RX-000002");
    expect(other.ticketNo).toBe("RX-000001");
  });

  it("forbids admins and employees from creating complaints", async () => {
    const byAdmin = await request(app).post(C).set(bearer(a.adminToken)).send(complaintBody);
    const byEmployee = await request(app).post(C).set(bearer(eve.token)).send(complaintBody);
    expect(byAdmin.status).toBe(403);
    expect(byEmployee.status).toBe(403);
  });

  it("validates input and ignores client-supplied status or customer", async () => {
    const bad = await request(app).post(C).set(bearer(a.customerToken)).send({ ...complaintBody, title: "no" });
    expect(bad.status).toBe(400);

    const res = await request(app)
      .post(C)
      .set(bearer(a.customerToken))
      .send({ ...complaintBody, status: "RESOLVED", customerId: b.customerId, organizationId: b.organizationId });
    expect(res.status).toBe(201);
    expect(res.body.data.complaint.status).toBe("OPEN");
    expect(res.body.data.complaint.customer.id).toBe(a.customerId);
    const stored = await Complaint.findById(res.body.data.complaint.id);
    expect(String(stored?.organizationId)).toBe(a.organizationId);
  });

  it("requires authentication", async () => {
    const res = await request(app).post(C).send(complaintBody);
    expect(res.status).toBe(401);
  });
});

describe("Visibility and tenant isolation", () => {
  it("customers see only their own complaints", async () => {
    await createComplaint(a.customerToken);
    const other = await request(app).post("/api/v1/auth/register").send({
      organizationSlug: "org-a",
      name: "Other Customer",
      email: "other@org-a.com",
      password: "Password123",
    });
    await createComplaint(other.body.data.accessToken, { title: "Another customer's complaint" });

    const res = await request(app).get(C).set(bearer(a.customerToken));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it("admins see all complaints of their own organization only", async () => {
    await createComplaint(a.customerToken);
    await createComplaint(b.customerToken);
    const res = await request(app).get(C).set(bearer(a.adminToken));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].customer.id).toBe(a.customerId);
  });

  it("returns 404 for a complaint from another organization (detail, assign, status, comments)", async () => {
    const theirs = await createComplaint(b.customerToken);
    const get = await request(app).get(`${C}/${theirs.id}`).set(bearer(a.adminToken));
    const assign = await request(app)
      .patch(`${C}/${theirs.id}/assign`)
      .set(bearer(a.adminToken))
      .send({ employeeId: eve.id });
    const comments = await request(app).get(`${C}/${theirs.id}/comments`).set(bearer(a.adminToken));
    expect(get.status).toBe(404);
    expect(assign.status).toBe(404);
    expect(comments.status).toBe(404);
  });

  it("returns 404 when a customer asks for another customer's complaint in the same organization", async () => {
    const mine = await createComplaint(a.customerToken);
    const other = await request(app).post("/api/v1/auth/register").send({
      organizationSlug: "org-a",
      name: "Other Customer",
      email: "other@org-a.com",
      password: "Password123",
    });
    const res = await request(app).get(`${C}/${mine.id}`).set(bearer(other.body.data.accessToken));
    expect(res.status).toBe(404);
  });

  it("employees see unassigned OPEN complaints and their own, but not others'", async () => {
    const open = await createComplaint(a.customerToken, { title: "Unassigned open complaint" });
    const taken = await createComplaint(a.customerToken, { title: "Assigned to someone else" });
    const frank = await createEmployee(a, "frank@org-a.com");
    await request(app).patch(`${C}/${taken.id}/assign`).set(bearer(a.adminToken)).send({ employeeId: frank.id });

    const res = await request(app).get(C).set(bearer(eve.token));
    const ids = res.body.data.map((c: { id: string }) => c.id);
    expect(ids).toEqual([open.id]);
    const direct = await request(app).get(`${C}/${taken.id}`).set(bearer(eve.token));
    expect(direct.status).toBe(404);
  });
});

describe("Listing, filtering, searching", () => {
  beforeEach(async () => {
    await createComplaint(a.customerToken, { title: "Billing mistake on invoice", category: "BILLING", priority: "LOW" });
    await createComplaint(a.customerToken, { title: "Router keeps rebooting", category: "NETWORK", priority: "CRITICAL" });
    await createComplaint(a.customerToken, { title: "Wrong plan activated", category: "ACCOUNT", priority: "MEDIUM" });
  });

  it("filters by priority, category and status", async () => {
    const p = await request(app).get(`${C}?priority=CRITICAL`).set(bearer(a.adminToken));
    const c = await request(app).get(`${C}?category=BILLING`).set(bearer(a.adminToken));
    const s = await request(app).get(`${C}?status=RESOLVED`).set(bearer(a.adminToken));
    expect(p.body.data).toHaveLength(1);
    expect(c.body.data).toHaveLength(1);
    expect(s.body.data).toHaveLength(0);
  });

  it("searches title and ticket number, treating text literally", async () => {
    const byTitle = await request(app).get(`${C}?q=router`).set(bearer(a.adminToken));
    const byTicket = await request(app).get(`${C}?q=RX-000003`).set(bearer(a.adminToken));
    const regex = await request(app).get(`${C}?q=.*`).set(bearer(a.adminToken));
    expect(byTitle.body.data).toHaveLength(1);
    expect(byTicket.body.data).toHaveLength(1);
    expect(regex.body.data).toHaveLength(0);
  });

  it("sorts and paginates", async () => {
    const oldest = await request(app).get(`${C}?sort=oldest&limit=2`).set(bearer(a.adminToken));
    expect(oldest.body.data.map((c: { ticketNo: string }) => c.ticketNo)).toEqual(["RX-000001", "RX-000002"]);
    expect(oldest.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });

  it("a client filter cannot widen a customer's scope", async () => {
    const res = await request(app)
      .get(`${C}?assignedTo=${eve.id}&q=a`)
      .set(bearer(a.customerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.every((c: { customer: { id: string } }) => c.customer.id === a.customerId)).toBe(true);
  });

  it("returns per-status stats for the caller's scope", async () => {
    const res = await request(app).get(`${C}/stats`).set(bearer(a.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.byStatus.OPEN).toBe(3);
  });
});

describe("Assignment and accepting", () => {
  it("admin assigns an employee: status becomes ASSIGNED and department follows the employee", async () => {
    const task = await createComplaint(a.customerToken);
    const res = await request(app).patch(`${C}/${task.id}/assign`).set(bearer(a.adminToken)).send({ employeeId: eve.id });
    expect(res.status).toBe(200);
    expect(res.body.data.complaint.status).toBe("ASSIGNED");
    expect(res.body.data.complaint.assignedTo.id).toBe(eve.id);
  });

  it("only admins may assign, and only to active employees of the same organization", async () => {
    const task = await createComplaint(a.customerToken);
    const byEmployee = await request(app).patch(`${C}/${task.id}/assign`).set(bearer(eve.token)).send({ employeeId: eve.id });
    const toCustomer = await request(app).patch(`${C}/${task.id}/assign`).set(bearer(a.adminToken)).send({ employeeId: a.customerId });
    const outsider = await createEmployee(b, "zed@org-b.com");
    const toOtherOrg = await request(app).patch(`${C}/${task.id}/assign`).set(bearer(a.adminToken)).send({ employeeId: outsider.id });
    expect(byEmployee.status).toBe(403);
    expect(toCustomer.status).toBe(404);
    expect(toOtherOrg.status).toBe(404);
  });

  it("an employee can accept an unassigned complaint; a second employee is told it was already taken (409)", async () => {
    const task = await createComplaint(a.customerToken);
    const frank = await createEmployee(a, "frank@org-a.com");
    const first = await request(app).post(`${C}/${task.id}/accept`).set(bearer(eve.token));
    const second = await request(app).post(`${C}/${task.id}/accept`).set(bearer(frank.token));
    expect(first.status).toBe(200);
    expect(first.body.data.complaint.assignedTo.id).toBe(eve.id);
    expect(second.status).toBe(409);
  });

  it("two simultaneous accepts: exactly one succeeds", async () => {
    const task = await createComplaint(a.customerToken);
    const frank = await createEmployee(a, "frank@org-a.com");
    const [r1, r2] = await Promise.all([
      request(app).post(`${C}/${task.id}/accept`).set(bearer(eve.token)),
      request(app).post(`${C}/${task.id}/accept`).set(bearer(frank.token)),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
  });
});

describe("Status lifecycle", () => {
  it("walks OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED with history", async () => {
    const task = await createComplaint(a.customerToken);
    const resolved = await resolveComplaint(a, task.id, eve);
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.complaint.status).toBe("RESOLVED");
    expect(resolved.body.data.complaint.resolutionNote).toBe("Replaced the faulty router");
    expect(resolved.body.data.complaint.firstRespondedAt).not.toBeNull();

    const closed = await request(app).post(`${C}/${task.id}/close`).set(bearer(a.customerToken));
    expect(closed.status).toBe(200);
    expect(closed.body.data.complaint.status).toBe("CLOSED");
    expect(closed.body.data.complaint.statusHistory.map((h: { status: string }) => h.status)).toEqual([
      "OPEN",
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
    ]);
  });

  it("rejects illegal transitions with 409", async () => {
    const task = await createComplaint(a.customerToken);
    await request(app).patch(`${C}/${task.id}/assign`).set(bearer(a.adminToken)).send({ employeeId: eve.id });
    const skip = await request(app).patch(`${C}/${task.id}/status`).set(bearer(eve.token)).send({ status: "RESOLVED", note: "done quickly" });
    const closeEarly = await request(app).post(`${C}/${task.id}/close`).set(bearer(a.customerToken));
    expect(skip.status).toBe(409);
    expect(closeEarly.status).toBe(409);
  });

  it("requires a resolution note to resolve", async () => {
    const task = await createComplaint(a.customerToken);
    await request(app).patch(`${C}/${task.id}/assign`).set(bearer(a.adminToken)).send({ employeeId: eve.id });
    await request(app).patch(`${C}/${task.id}/status`).set(bearer(eve.token)).send({ status: "IN_PROGRESS" });
    const res = await request(app).patch(`${C}/${task.id}/status`).set(bearer(eve.token)).send({ status: "RESOLVED" });
    expect(res.status).toBe(400);
  });

  it("customers cannot change status; employees cannot change someone else's complaint", async () => {
    const task = await createComplaint(a.customerToken);
    const byCustomer = await request(app).patch(`${C}/${task.id}/status`).set(bearer(a.customerToken)).send({ status: "IN_PROGRESS" });
    expect(byCustomer.status).toBe(403);

    const frank = await createEmployee(a, "frank@org-a.com");
    await request(app).patch(`${C}/${task.id}/assign`).set(bearer(a.adminToken)).send({ employeeId: frank.id });
    const byEve = await request(app).patch(`${C}/${task.id}/status`).set(bearer(eve.token)).send({ status: "IN_PROGRESS" });
    expect(byEve.status).toBe(404);
  });
});

describe("Reopening", () => {
  it("customer reopens a resolved complaint: SLA restarts and reopenCount increases", async () => {
    const task = await createComplaint(a.customerToken);
    await resolveComplaint(a, task.id, eve);
    const res = await request(app).post(`${C}/${task.id}/reopen`).set(bearer(a.customerToken)).send({ reason: "Problem is back again" });
    expect(res.status).toBe(200);
    expect(res.body.data.complaint.status).toBe("REOPENED");
    expect(res.body.data.complaint.reopenCount).toBe(1);
    expect(res.body.data.complaint.resolvedAt).toBeNull();

    const resumed = await request(app).patch(`${C}/${task.id}/status`).set(bearer(eve.token)).send({ status: "IN_PROGRESS" });
    expect(resumed.status).toBe(200);
  });

  it("refuses to reopen after the organization's reopen window", async () => {
    const task = await createComplaint(a.customerToken);
    await resolveComplaint(a, task.id, eve);
    await Complaint.updateOne({ _id: task.id }, { resolvedAt: new Date(Date.now() - 10 * 86_400_000) });
    const res = await request(app).post(`${C}/${task.id}/reopen`).set(bearer(a.customerToken)).send({ reason: "Problem is back again" });
    expect(res.status).toBe(409);
  });

  it("honours a shorter window set by the admin", async () => {
    await Organization.updateOne({ slug: "org-a" }, { "settings.reopenWindowDays": 1 });
    const task = await createComplaint(a.customerToken);
    await resolveComplaint(a, task.id, eve);
    await Complaint.updateOne({ _id: task.id }, { resolvedAt: new Date(Date.now() - 2 * 86_400_000) });
    const res = await request(app).post(`${C}/${task.id}/reopen`).set(bearer(a.customerToken)).send({ reason: "Problem is back again" });
    expect(res.status).toBe(409);
  });

  it("only resolved complaints can be reopened, and only by customers", async () => {
    const task = await createComplaint(a.customerToken);
    const early = await request(app).post(`${C}/${task.id}/reopen`).set(bearer(a.customerToken)).send({ reason: "Not resolved yet" });
    const byAdmin = await request(app).post(`${C}/${task.id}/reopen`).set(bearer(a.adminToken)).send({ reason: "Admin trying" });
    expect(early.status).toBe(409);
    expect(byAdmin.status).toBe(403);
  });
});
