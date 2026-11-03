import request from "supertest";
import { createApp } from "../../src/app";

export const app = createApp();

export interface Tenant {
  slug: string;
  organizationId: string;
  adminToken: string;
  adminId: string;
  customerToken: string;
  customerId: string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// Creates an organization with one ADMIN and one CUSTOMER, through the real API.
export async function createTenant(slug: string): Promise<Tenant> {
  const orgRes = await request(app).post("/api/v1/auth/register-org").send({
    organizationName: `Org ${slug}`,
    organizationSlug: slug,
    name: `Admin ${slug}`,
    email: `admin@${slug}.com`,
    password: "Password123",
  });
  const customerRes = await request(app).post("/api/v1/auth/register").send({
    organizationSlug: slug,
    name: `Customer ${slug}`,
    email: `customer@${slug}.com`,
    password: "Password123",
  });
  return {
    slug,
    organizationId: orgRes.body.data.user.organizationId,
    adminToken: orgRes.body.data.accessToken,
    adminId: orgRes.body.data.user.id,
    customerToken: customerRes.body.data.accessToken,
    customerId: customerRes.body.data.user.id,
  };
}

// Admin creates an employee through the API, then the employee logs in.
export async function createEmployee(
  tenant: Tenant,
  email: string,
  extra: { departmentId?: string; name?: string } = {}
): Promise<{ id: string; token: string }> {
  const created = await request(app)
    .post("/api/v1/users/employees")
    .set(bearer(tenant.adminToken))
    .send({ name: extra.name ?? "Eve Employee", email, password: "Password123", ...extra });
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ organizationSlug: tenant.slug, email, password: "Password123" });
  return { id: created.body.data.user.id, token: login.body.data.accessToken };
}

export async function createDepartment(tenant: Tenant, name: string): Promise<string> {
  const res = await request(app)
    .post("/api/v1/departments")
    .set(bearer(tenant.adminToken))
    .send({ name });
  return res.body.data.department.id;
}

export const complaintBody = {
  title: "Internet is down for two days",
  description: "The connection drops every few minutes and has been unusable since Monday.",
  category: "NETWORK",
  priority: "HIGH",
};

export async function createComplaint(
  token: string,
  overrides: Partial<typeof complaintBody> = {}
): Promise<{ id: string; ticketNo: string }> {
  const res = await request(app)
    .post("/api/v1/complaints")
    .set(bearer(token))
    .send({ ...complaintBody, ...overrides });
  return { id: res.body.data.complaint.id, ticketNo: res.body.data.complaint.ticketNo };
}

// Moves a complaint all the way to RESOLVED using the real endpoints.
export async function resolveComplaint(tenant: Tenant, complaintId: string, employee: { id: string; token: string }) {
  await request(app).patch(`/api/v1/complaints/${complaintId}/assign`).set(bearer(tenant.adminToken)).send({ employeeId: employee.id });
  await request(app).patch(`/api/v1/complaints/${complaintId}/status`).set(bearer(employee.token)).send({ status: "IN_PROGRESS" });
  return request(app)
    .patch(`/api/v1/complaints/${complaintId}/status`)
    .set(bearer(employee.token))
    .send({ status: "RESOLVED", note: "Replaced the faulty router" });
}
