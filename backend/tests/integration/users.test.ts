import request from "supertest";
import { RefreshToken } from "../../src/models/RefreshToken";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";
import { Tenant, app, bearer, createDepartment, createEmployee, createTenant } from "../helpers/tenants";

const USERS = "/api/v1/users";
let a: Tenant;
let b: Tenant;

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearDb();
  a = await createTenant("org-a");
  b = await createTenant("org-b");
});

describe("Creating employees", () => {
  const body = { name: "Eve Employee", email: "eve@org-a.com", password: "Password123" };

  it("lets an admin create an employee who can then log in", async () => {
    const res = await request(app).post(`${USERS}/employees`).set(bearer(a.adminToken)).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("EMPLOYEE");

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ organizationSlug: "org-a", email: body.email, password: body.password });
    expect(login.status).toBe(200);
  });

  it("ignores a role sent by the client", async () => {
    const res = await request(app)
      .post(`${USERS}/employees`)
      .set(bearer(a.adminToken))
      .send({ ...body, role: "ADMIN" });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("EMPLOYEE");
  });

  it("forbids employees and customers from creating employees", async () => {
    const employee = await createEmployee(a, "eve@org-a.com");
    const byCustomer = await request(app).post(`${USERS}/employees`).set(bearer(a.customerToken)).send(body);
    const byEmployee = await request(app)
      .post(`${USERS}/employees`)
      .set(bearer(employee.token))
      .send({ ...body, email: "other@org-a.com" });
    expect(byCustomer.status).toBe(403);
    expect(byEmployee.status).toBe(403);
  });

  it("rejects a duplicate email in the same organization with 409", async () => {
    await request(app).post(`${USERS}/employees`).set(bearer(a.adminToken)).send(body);
    const res = await request(app).post(`${USERS}/employees`).set(bearer(a.adminToken)).send(body);
    expect(res.status).toBe(409);
  });

  it("rejects a department from another organization with 404", async () => {
    const theirDept = await createDepartment(b, "Network");
    const res = await request(app)
      .post(`${USERS}/employees`)
      .set(bearer(a.adminToken))
      .send({ ...body, departmentId: theirDept });
    expect(res.status).toBe(404);
  });

  it("validates input", async () => {
    const res = await request(app)
      .post(`${USERS}/employees`)
      .set(bearer(a.adminToken))
      .send({ name: "E", email: "bad", password: "weak" });
    expect(res.status).toBe(400);
  });
});

describe("Listing and searching users", () => {
  beforeEach(async () => {
    await createEmployee(a, "eve@org-a.com", { name: "Eve Employee" });
    await createEmployee(a, "frank@org-a.com", { name: "Frank Fixer" });
    await createEmployee(b, "gina@org-b.com", { name: "Gina Other" });
  });

  it("only returns users of the caller's organization", async () => {
    const res = await request(app).get(USERS).set(bearer(a.adminToken));
    const emails: string[] = res.body.data.map((u: { email: string }) => u.email);
    expect(emails.every((e) => e.endsWith("@org-a.com"))).toBe(true);
    expect(res.body.meta.total).toBe(4); // admin + customer + 2 employees
  });

  it("filters by role", async () => {
    const res = await request(app).get(`${USERS}?role=EMPLOYEE`).set(bearer(a.adminToken));
    expect(res.body.data).toHaveLength(2);
  });

  it("searches by name or email, case-insensitively", async () => {
    const byName = await request(app).get(`${USERS}?q=frank`).set(bearer(a.adminToken));
    const byEmail = await request(app).get(`${USERS}?q=EVE@`).set(bearer(a.adminToken));
    expect(byName.body.data).toHaveLength(1);
    expect(byEmail.body.data).toHaveLength(1);
  });

  it("treats the search text literally (no regex injection)", async () => {
    const res = await request(app).get(`${USERS}?q=.*`).set(bearer(a.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("does not show other organizations' users in search", async () => {
    const res = await request(app).get(`${USERS}?q=gina`).set(bearer(a.adminToken));
    expect(res.body.data).toHaveLength(0);
  });

  it("forbids non-admins", async () => {
    const res = await request(app).get(USERS).set(bearer(a.customerToken));
    expect(res.status).toBe(403);
  });
});

describe("Updating users", () => {
  it("assigns and clears a department for an employee", async () => {
    const dept = await createDepartment(a, "Billing");
    const eve = await createEmployee(a, "eve@org-a.com");

    const set = await request(app).patch(`${USERS}/${eve.id}`).set(bearer(a.adminToken)).send({ departmentId: dept });
    expect(set.status).toBe(200);
    expect(set.body.data.user.departmentId).toBe(dept);

    const cleared = await request(app).patch(`${USERS}/${eve.id}`).set(bearer(a.adminToken)).send({ departmentId: null });
    expect(cleared.body.data.user.departmentId).toBeUndefined();
  });

  it("refuses to put a customer into a department", async () => {
    const dept = await createDepartment(a, "Billing");
    const res = await request(app)
      .patch(`${USERS}/${a.customerId}`)
      .set(bearer(a.adminToken))
      .send({ departmentId: dept });
    expect(res.status).toBe(400);
  });

  it("cannot be used on a user from another organization (404)", async () => {
    const res = await request(app).patch(`${USERS}/${b.customerId}`).set(bearer(a.adminToken)).send({ name: "Hacked Name" });
    expect(res.status).toBe(404);
  });

  it("deactivating a user blocks login, kills the old token and revokes refresh tokens", async () => {
    const eve = await createEmployee(a, "eve@org-a.com");

    const res = await request(app).patch(`${USERS}/${eve.id}`).set(bearer(a.adminToken)).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(false);

    const oldToken = await request(app).get("/api/v1/auth/me").set(bearer(eve.token));
    expect(oldToken.status).toBe(401);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ organizationSlug: "org-a", email: "eve@org-a.com", password: "Password123" });
    expect(login.status).toBe(403);

    const active = await RefreshToken.countDocuments({ userId: eve.id, revokedAt: null });
    expect(active).toBe(0);
  });

  it("does not let an admin deactivate themselves", async () => {
    const res = await request(app).patch(`${USERS}/${a.adminId}`).set(bearer(a.adminToken)).send({ isActive: false });
    expect(res.status).toBe(400);
  });

  it("rejects an empty update", async () => {
    const res = await request(app).patch(`${USERS}/${a.customerId}`).set(bearer(a.adminToken)).send({});
    expect(res.status).toBe(400);
  });
});

describe("Editing your own profile", () => {
  it("lets any role change their own name", async () => {
    const res = await request(app).patch(`${USERS}/me`).set(bearer(a.customerToken)).send({ name: "New Name" });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe("New Name");
  });

  it("ignores role, email and isActive in the body", async () => {
    const res = await request(app)
      .patch(`${USERS}/me`)
      .set(bearer(a.customerToken))
      .send({ name: "New Name", role: "ADMIN", email: "evil@x.com", isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe("CUSTOMER");
    expect(res.body.data.user.email).toBe("customer@org-a.com");
  });

  it("requires authentication", async () => {
    const res = await request(app).patch(`${USERS}/me`).send({ name: "Anon Name" });
    expect(res.status).toBe(401);
  });
});
