import request from "supertest";
import { runSlaCheck } from "../../src/jobs/slaEscalation.job";
import { Complaint } from "../../src/models/Complaint";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";
import { Tenant, app, bearer, createComplaint, createEmployee, createTenant, resolveComplaint } from "../helpers/tenants";

const AN = "/api/v1/analytics";
let a: Tenant;
let b: Tenant;
let eve: { id: string; token: string };
let frank: { id: string; token: string };

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearDb();
  a = await createTenant("org-a");
  b = await createTenant("org-b");
  eve = await createEmployee(a, "eve@org-a.com");
  frank = await createEmployee(a, "frank@org-a.com");

  // Organization A: 4 complaints. c1 resolved on time, c2 resolved late, c3 assigned and overdue (escalated), c4 untouched.
  const c1 = await createComplaint(a.customerToken, { title: "Complaint number one" });
  const c2 = await createComplaint(a.customerToken, { title: "Complaint number two" });
  const c3 = await createComplaint(a.customerToken, { title: "Complaint number three" });
  await createComplaint(a.customerToken, { title: "Complaint number four" });
  await resolveComplaint(a, c1.id, eve);
  await resolveComplaint(a, c2.id, eve);
  const late = await Complaint.findById(c2.id);
  await Complaint.updateOne({ _id: c2.id }, { resolutionDueAt: new Date(late!.resolvedAt!.getTime() - 3_600_000) });
  await request(app).patch(`/api/v1/complaints/${c3.id}/assign`).set(bearer(a.adminToken)).send({ employeeId: eve.id });
  await Complaint.updateOne({ _id: c3.id }, { resolutionDueAt: new Date(Date.now() - 60_000) });
  await runSlaCheck();

  // Organization B has its own data that must never leak into A's numbers.
  await createComplaint(b.customerToken);
  await createComplaint(b.customerToken);
});

describe("Analytics", () => {
  it("summary computes totals, rates and SLA compliance for the caller's organization only", async () => {
    const res = await request(app).get(`${AN}/summary`).set(bearer(a.adminToken));
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(s.total).toBe(4);
    expect(s.resolved).toBe(2);
    expect(s.pending).toBe(2);
    expect(s.escalated).toBe(1);
    expect(s.resolutionRate).toBe(50);
    expect(s.slaCompliance).toBe(50);
    expect(s.byStatus).toMatchObject({ OPEN: 1, ASSIGNED: 1, RESOLVED: 2 });
    expect(s.avgResolutionHours).toEqual(expect.any(Number));
  });

  it("returns null (not zero) rates for an organization with no data", async () => {
    const c = await createTenant("org-c");
    const res = await request(app).get(`${AN}/summary`).set(bearer(c.adminToken));
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.resolutionRate).toBeNull();
    expect(res.body.data.slaCompliance).toBeNull();
    expect(res.body.data.avgRating).toBeNull();
  });

  it("includes the average customer rating", async () => {
    const task = await Complaint.findOne({ status: "RESOLVED", organizationId: a.organizationId });
    await request(app).post(`/api/v1/complaints/${task!.id}/feedback`).set(bearer(a.customerToken)).send({ rating: 4 });
    const res = await request(app).get(`${AN}/summary`).set(bearer(a.adminToken));
    expect(res.body.data.avgRating).toBe(4);
    expect(res.body.data.ratingCount).toBe(1);
  });

  it("groups by department", async () => {
    const res = await request(app).get(`${AN}/by-department`).set(bearer(a.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ name: "Unassigned", total: 4, resolved: 2, escalated: 1 });
  });

  it("returns a zero-filled daily trend", async () => {
    const res = await request(app).get(`${AN}/trends?days=7`).set(bearer(a.adminToken));
    expect(res.body.data).toHaveLength(7);
    const created = res.body.data.reduce((sum: number, p: { created: number }) => sum + p.created, 0);
    const resolved = res.body.data.reduce((sum: number, p: { resolved: number }) => sum + p.resolved, 0);
    expect(created).toBe(4);
    expect(resolved).toBe(2);
    const bad = await request(app).get(`${AN}/trends?days=1000`).set(bearer(a.adminToken));
    expect(bad.status).toBe(400);
  });

  it("workload: admin sees all employees, employees see only themselves", async () => {
    const admin = await request(app).get(`${AN}/workload`).set(bearer(a.adminToken));
    const eveRow = admin.body.data.find((w: { employeeId: string }) => w.employeeId === eve.id);
    expect(admin.body.data).toHaveLength(2);
    expect(eveRow).toMatchObject({ assigned: 1, escalated: 1, resolvedLast7Days: 2, open: 1 });

    const own = await request(app).get(`${AN}/workload`).set(bearer(frank.token));
    expect(own.body.data).toHaveLength(1);
    expect(own.body.data[0].employeeId).toBe(frank.id);
    expect(own.body.data[0].open).toBe(0);
  });

  it("restricts admin-only analytics", async () => {
    const byCustomer = await request(app).get(`${AN}/summary`).set(bearer(a.customerToken));
    const byEmployee = await request(app).get(`${AN}/summary`).set(bearer(eve.token));
    const workloadByCustomer = await request(app).get(`${AN}/workload`).set(bearer(a.customerToken));
    expect(byCustomer.status).toBe(403);
    expect(byEmployee.status).toBe(403);
    expect(workloadByCustomer.status).toBe(403);
  });
});
