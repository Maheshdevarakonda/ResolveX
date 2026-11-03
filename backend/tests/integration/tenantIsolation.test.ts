import request from "supertest";
import { createApp } from "../../src/app";
import { Organization } from "../../src/models/Organization";
import { clearDb, startTestDb, stopTestDb } from "../helpers/db";

const app = createApp();
const ORG = "/api/v1/organization";

interface Tenant {
  slug: string;
  adminToken: string;
  adminId: string;
  organizationId: string;
  customerToken: string;
  customerId: string;
}

async function createTenant(slug: string): Promise<Tenant> {
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
    adminToken: orgRes.body.data.accessToken,
    adminId: orgRes.body.data.user.id,
    organizationId: orgRes.body.data.user.organizationId,
    customerToken: customerRes.body.data.accessToken,
    customerId: customerRes.body.data.user.id,
  };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let a: Tenant;
let b: Tenant;

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearDb();
  a = await createTenant("org-a");
  b = await createTenant("org-b");
});

describe("Organization access", () => {
  it("returns each admin their own organization only", async () => {
    const resA = await request(app).get(ORG).set(auth(a.adminToken));
    const resB = await request(app).get(ORG).set(auth(b.adminToken));
    expect(resA.status).toBe(200);
    expect(resA.body.data.organization.slug).toBe("org-a");
    expect(resB.body.data.organization.slug).toBe("org-b");
  });

  it("forbids non-admins (403) and anonymous users (401)", async () => {
    const customer = await request(app).get(ORG).set(auth(a.customerToken));
    const anonymous = await request(app).get(ORG);
    expect(customer.status).toBe(403);
    expect(anonymous.status).toBe(401);
  });

  it("updating one organization never touches another", async () => {
    const res = await request(app)
      .patch(ORG)
      .set(auth(a.adminToken))
      .send({ name: "Renamed A", settings: { reopenWindowDays: 14 } });
    expect(res.status).toBe(200);
    expect(res.body.data.organization.name).toBe("Renamed A");
    expect(res.body.data.organization.settings.reopenWindowDays).toBe(14);

    const orgB = await Organization.findOne({ slug: "org-b" });
    expect(orgB?.name).toBe("Org org-b");
  });

  it("ignores attempts to change the slug or inject an organization id", async () => {
    const res = await request(app)
      .patch(ORG)
      .set(auth(a.adminToken))
      .send({ name: "Still A", organizationSlug: "hijacked", slug: "hijacked", _id: b.organizationId });
    expect(res.status).toBe(200);
    expect(res.body.data.organization.slug).toBe("org-a");
    expect(res.body.data.organization.id).toBe(a.organizationId);
  });

  it("rejects an update with no valid fields", async () => {
    const res = await request(app).patch(ORG).set(auth(a.adminToken)).send({ slug: "nope" });
    expect(res.status).toBe(400);
  });
});

describe("Member listing is tenant-scoped", () => {
  it("lists only users of the caller's organization", async () => {
    const res = await request(app).get(`${ORG}/members`).set(auth(a.adminToken));
    expect(res.status).toBe(200);
    const emails = res.body.data.map((u: { email: string }) => u.email).sort();
    expect(emails).toEqual(["admin@org-a.com", "customer@org-a.com"]);
    expect(res.body.meta.total).toBe(2);
  });

  it("ignores an organizationId passed in the query string", async () => {
    const res = await request(app)
      .get(`${ORG}/members?organizationId=${b.organizationId}`)
      .set(auth(a.adminToken));
    expect(res.status).toBe(200);
    const emails = res.body.data.map((u: { email: string }) => u.email);
    expect(emails.every((e: string) => e.endsWith("@org-a.com"))).toBe(true);
  });

  it("filters by role and paginates", async () => {
    const byRole = await request(app).get(`${ORG}/members?role=CUSTOMER`).set(auth(a.adminToken));
    expect(byRole.body.data).toHaveLength(1);
    expect(byRole.body.data[0].role).toBe("CUSTOMER");

    const paged = await request(app).get(`${ORG}/members?page=2&limit=1`).set(auth(a.adminToken));
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
  });

  it("rejects invalid pagination values with 400", async () => {
    const res = await request(app).get(`${ORG}/members?limit=5000`).set(auth(a.adminToken));
    expect(res.status).toBe(400);
  });
});

describe("Cross-tenant access to a single record", () => {
  it("returns a user from the same organization", async () => {
    const res = await request(app).get(`${ORG}/members/${a.customerId}`).set(auth(a.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("customer@org-a.com");
  });

  it("returns 404 (not 403) for a user that belongs to another organization", async () => {
    const res = await request(app).get(`${ORG}/members/${b.customerId}`).set(auth(a.adminToken));
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const res = await request(app).get(`${ORG}/members/not-an-id`).set(auth(a.adminToken));
    expect(res.status).toBe(400);
  });
});

describe("Cross-tenant authentication", () => {
  it("does not let an org A user log in to org B", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({
      organizationSlug: "org-b",
      email: "admin@org-a.com",
      password: "Password123",
    });
    expect(res.status).toBe(401);
  });
});

describe("Organization settings affect registration", () => {
  it("blocks new customer self-registration when disabled", async () => {
    await request(app)
      .patch(ORG)
      .set(auth(a.adminToken))
      .send({ settings: { allowCustomerRegistration: false } });

    const blocked = await request(app).post("/api/v1/auth/register").send({
      organizationSlug: "org-a",
      name: "New Customer",
      email: "new@org-a.com",
      password: "Password123",
    });
    expect(blocked.status).toBe(403);

    // Other organizations are not affected.
    const other = await request(app).post("/api/v1/auth/register").send({
      organizationSlug: "org-b",
      name: "New Customer",
      email: "new@org-b.com",
      password: "Password123",
    });
    expect(other.status).toBe(201);
  });
});
