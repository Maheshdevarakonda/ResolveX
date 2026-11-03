import request from "supertest";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";
import { Tenant, app, bearer, createDepartment, createEmployee, createTenant } from "../helpers/tenants";

const DEPTS = "/api/v1/departments";
let a: Tenant;
let b: Tenant;

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearDb();
  a = await createTenant("org-a");
  b = await createTenant("org-b");
});

describe("Departments: permissions", () => {
  it("lets an admin create a department", async () => {
    const res = await request(app)
      .post(DEPTS)
      .set(bearer(a.adminToken))
      .send({ name: "Billing", description: "Invoices and payments" });
    expect(res.status).toBe(201);
    expect(res.body.data.department.name).toBe("Billing");
  });

  it("forbids customers entirely and employees from creating", async () => {
    const employee = await createEmployee(a, "eve@org-a.com");

    const customerList = await request(app).get(DEPTS).set(bearer(a.customerToken));
    const employeeCreate = await request(app).post(DEPTS).set(bearer(employee.token)).send({ name: "Sneaky" });
    const employeeList = await request(app).get(DEPTS).set(bearer(employee.token));

    expect(customerList.status).toBe(403);
    expect(employeeCreate.status).toBe(403);
    expect(employeeList.status).toBe(200);
  });

  it("requires authentication", async () => {
    const res = await request(app).get(DEPTS);
    expect(res.status).toBe(401);
  });
});

describe("Departments: validation and uniqueness", () => {
  it("rejects a too-short name with 400", async () => {
    const res = await request(app).post(DEPTS).set(bearer(a.adminToken)).send({ name: "x" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate name, ignoring case, with 409", async () => {
    await createDepartment(a, "Billing");
    const res = await request(app).post(DEPTS).set(bearer(a.adminToken)).send({ name: "billing" });
    expect(res.status).toBe(409);
  });

  it("allows the same department name in a different organization", async () => {
    await createDepartment(a, "Billing");
    const res = await request(app).post(DEPTS).set(bearer(b.adminToken)).send({ name: "Billing" });
    expect(res.status).toBe(201);
  });

  it("updates a department and rejects renaming onto an existing name", async () => {
    const billing = await createDepartment(a, "Billing");
    await createDepartment(a, "Support");

    const ok = await request(app)
      .patch(`${DEPTS}/${billing}`)
      .set(bearer(a.adminToken))
      .send({ description: "Updated" });
    expect(ok.status).toBe(200);

    const clash = await request(app)
      .patch(`${DEPTS}/${billing}`)
      .set(bearer(a.adminToken))
      .send({ name: "support" });
    expect(clash.status).toBe(409);
  });

  it("returns 400 for a malformed id", async () => {
    const res = await request(app).patch(`${DEPTS}/not-an-id`).set(bearer(a.adminToken)).send({ name: "Valid Name" });
    expect(res.status).toBe(400);
  });
});

describe("Departments: tenant isolation", () => {
  it("lists only the caller's departments", async () => {
    await createDepartment(a, "Billing");
    await createDepartment(b, "Network");

    const res = await request(app).get(DEPTS).set(bearer(a.adminToken));
    const names = res.body.data.map((d: { name: string }) => d.name);
    expect(names).toEqual(["Billing"]);
  });

  it("returns 404 when updating or deleting another organization's department", async () => {
    const theirs = await createDepartment(b, "Network");

    const patch = await request(app).patch(`${DEPTS}/${theirs}`).set(bearer(a.adminToken)).send({ name: "Hijacked" });
    const del = await request(app).delete(`${DEPTS}/${theirs}`).set(bearer(a.adminToken));
    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);

    const stillThere = await request(app).get(DEPTS).set(bearer(b.adminToken));
    expect(stillThere.body.data[0].name).toBe("Network");
  });
});

describe("Departments: deletion rules", () => {
  it("blocks deleting a department that still has employees, then allows it after reassignment", async () => {
    const dept = await createDepartment(a, "Billing");
    const employee = await createEmployee(a, "eve@org-a.com", { departmentId: dept });

    const blocked = await request(app).delete(`${DEPTS}/${dept}`).set(bearer(a.adminToken));
    expect(blocked.status).toBe(409);

    await request(app)
      .patch(`/api/v1/users/${employee.id}`)
      .set(bearer(a.adminToken))
      .send({ departmentId: null });

    const allowed = await request(app).delete(`${DEPTS}/${dept}`).set(bearer(a.adminToken));
    expect(allowed.status).toBe(200);
  });
});
