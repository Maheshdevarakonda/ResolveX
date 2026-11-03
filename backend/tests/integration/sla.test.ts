import request from "supertest";
import { runSlaCheck } from "../../src/jobs/slaEscalation.job";
import { AuditLog } from "../../src/models/AuditLog";
import { Complaint } from "../../src/models/Complaint";
import { Notification } from "../../src/models/Notification";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";
import { Tenant, app, bearer, createComplaint, createEmployee, createTenant, resolveComplaint } from "../helpers/tenants";

const SLA = "/api/v1/sla-policies";
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

const makeOverdue = (id: string) => Complaint.updateOne({ _id: id }, { resolutionDueAt: new Date(Date.now() - 60_000) });

describe("SLA policies", () => {
  it("returns defaults for all four priorities", async () => {
    const res = await request(app).get(SLA).set(bearer(a.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { priority: string }) => p.priority)).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  });

  it("saves custom policies that apply to new complaints, per organization", async () => {
    const save = await request(app)
      .put(SLA)
      .set(bearer(a.adminToken))
      .send({ policies: [{ priority: "HIGH", responseMinutes: 10, resolutionMinutes: 60 }] });
    expect(save.status).toBe(200);

    const mine = await request(app).post("/api/v1/complaints").set(bearer(a.customerToken)).send({
      title: "Urgent outage in the office",
      description: "Everything is down and we cannot work at all today.",
      category: "NETWORK",
      priority: "HIGH",
    });
    const minutes =
      (new Date(mine.body.data.complaint.resolutionDueAt).getTime() - new Date(mine.body.data.complaint.createdAt).getTime()) / 60_000;
    expect(Math.round(minutes)).toBe(60);

    const theirs = await request(app).get(SLA).set(bearer(b.adminToken));
    expect(theirs.body.data.find((p: { priority: string }) => p.priority === "HIGH").resolutionMinutes).toBe(1440);
  });

  it("validates policies and restricts access to admins", async () => {
    const bad = await request(app)
      .put(SLA)
      .set(bearer(a.adminToken))
      .send({ policies: [{ priority: "HIGH", responseMinutes: 120, resolutionMinutes: 60 }] });
    const dup = await request(app).put(SLA).set(bearer(a.adminToken)).send({
      policies: [
        { priority: "HIGH", responseMinutes: 10, resolutionMinutes: 60 },
        { priority: "HIGH", responseMinutes: 10, resolutionMinutes: 60 },
      ],
    });
    const forbidden = await request(app).get(SLA).set(bearer(eve.token));
    expect(bad.status).toBe(400);
    expect(dup.status).toBe(400);
    expect(forbidden.status).toBe(403);
  });
});

describe("SLA escalation job", () => {
  it("escalates an overdue complaint once, records history, audit and notifications", async () => {
    const task = await createComplaint(a.customerToken);
    await request(app).patch(`/api/v1/complaints/${task.id}/assign`).set(bearer(a.adminToken)).send({ employeeId: eve.id });
    await makeOverdue(task.id);

    const first = await runSlaCheck();
    expect(first.escalated).toBe(1);

    const c = await Complaint.findById(task.id);
    expect(c?.isEscalated).toBe(true);
    expect(c?.escalationHistory).toHaveLength(1);

    expect(await AuditLog.countDocuments({ complaintId: task.id, action: "COMPLAINT_ESCALATED", actorName: "System" })).toBe(1);
    expect(await Notification.countDocuments({ complaintId: task.id, type: "ESCALATED", userId: a.adminId })).toBe(1);
    expect(await Notification.countDocuments({ complaintId: task.id, type: "ESCALATED", userId: eve.id })).toBe(1);
  });

  it("never escalates twice, even when the job runs again or concurrently", async () => {
    const task = await createComplaint(a.customerToken);
    await makeOverdue(task.id);

    const results = await Promise.all([runSlaCheck(), runSlaCheck(), runSlaCheck()]);
    expect(results.reduce((sum, r) => sum + r.escalated, 0)).toBe(1);
    expect((await runSlaCheck()).escalated).toBe(0);
    expect((await Complaint.findById(task.id))?.escalationHistory).toHaveLength(1);
    expect(await AuditLog.countDocuments({ complaintId: task.id, action: "COMPLAINT_ESCALATED" })).toBe(1);
  });

  it("ignores complaints that are not overdue or are already resolved", async () => {
    const fine = await createComplaint(a.customerToken);
    const done = await createComplaint(a.customerToken);
    await resolveComplaint(a, done.id, eve);
    await makeOverdue(done.id);

    expect((await runSlaCheck()).escalated).toBe(0);
    expect((await Complaint.findById(fine.id))?.isEscalated).toBe(false);
    expect((await Complaint.findById(done.id))?.isEscalated).toBe(false);
  });

  it("escalates complaints of every organization, each notifying its own admins only", async () => {
    const t1 = await createComplaint(a.customerToken);
    const t2 = await createComplaint(b.customerToken);
    await makeOverdue(t1.id);
    await makeOverdue(t2.id);

    expect((await runSlaCheck()).escalated).toBe(2);
    expect(await Notification.countDocuments({ complaintId: t1.id, type: "ESCALATED", userId: b.adminId })).toBe(0);
    expect(await Notification.countDocuments({ complaintId: t2.id, type: "ESCALATED", userId: a.adminId })).toBe(0);
  });

  it("warns once when a deadline is close", async () => {
    const task = await createComplaint(a.customerToken);
    await Complaint.updateOne({ _id: task.id }, { resolutionDueAt: new Date(Date.now() + 20 * 60_000) });

    expect((await runSlaCheck()).warned).toBe(1);
    expect((await runSlaCheck()).warned).toBe(0);
    expect(await Notification.countDocuments({ complaintId: task.id, type: "SLA_WARNING" })).toBeGreaterThan(0);
    expect((await Complaint.findById(task.id))?.isEscalated).toBe(false);
  });

  it("an escalated complaint shows up in the escalated filter and can be reset by reopening", async () => {
    const task = await createComplaint(a.customerToken);
    await makeOverdue(task.id);
    await runSlaCheck();

    const list = await request(app).get("/api/v1/complaints?isEscalated=true").set(bearer(a.adminToken));
    expect(list.body.data).toHaveLength(1);

    await resolveComplaint(a, task.id, eve);
    const reopened = await request(app)
      .post(`/api/v1/complaints/${task.id}/reopen`)
      .set(bearer(a.customerToken))
      .send({ reason: "Problem is back again" });
    expect(reopened.body.data.complaint.isEscalated).toBe(false);
    expect(reopened.body.data.complaint.escalationHistory).toHaveLength(1); // history is kept
  });
});
