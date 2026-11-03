/* Demo data generator.  Usage:  npm run seed            (creates the "demo-org" organization)
 *                              npm run seed -- --reset  (deletes demo-org first)
 *
 * IMPORTANT: everything created here is FAKE DEMO DATA. Any dashboard number or benchmark taken
 * from it must be labelled "measured on seeded demo data" (see docs/PERFORMANCE_REPORT.md). */
import mongoose, { Types } from "mongoose";
import { connectDB, disconnectDB } from "../config/db";
import { Comment } from "../models/Comment";
import { Complaint, CATEGORIES, PRIORITIES } from "../models/Complaint";
import { Counter } from "../models/Counter";
import { Department } from "../models/Department";
import { Feedback } from "../models/Feedback";
import { AuditLog } from "../models/AuditLog";
import { Notification } from "../models/Notification";
import { Organization } from "../models/Organization";
import { RefreshToken } from "../models/RefreshToken";
import { SLAPolicy } from "../models/SLAPolicy";
import { User } from "../models/User";
import { DEFAULT_POLICIES } from "../modules/sla/sla.service";
import { hashPassword } from "../utils/password";

const SLUG = "demo-org";
const PASSWORD = "Demo1234";
const COMPLAINTS = Number(process.env.SEED_COMPLAINTS ?? 150);
const DAY = 86_400_000;

// Small deterministic random generator, so every run produces the same data.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(42);
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];

const TITLES = [
  "Internet keeps disconnecting", "Wrong amount on my invoice", "Cannot log in to my account", "Router overheating",
  "Service not activated after payment", "Double charge this month", "Slow speeds in the evening", "Product arrived damaged",
  "Plan change was not applied", "No reply to my earlier request",
];

async function main() {
  await connectDB();
  const existing = await Organization.findOne({ slug: SLUG });
  if (existing) {
    if (!process.argv.includes("--reset")) {
      console.log(`"${SLUG}" already exists. Run with --reset to rebuild it.`);
      await disconnectDB();
      return;
    }
    const org = { organizationId: existing._id };
    await Promise.all([
      Comment.deleteMany(org), Complaint.deleteMany(org), Counter.deleteMany(org), Department.deleteMany(org),
      Feedback.deleteMany(org), AuditLog.deleteMany(org), Notification.deleteMany(org), RefreshToken.deleteMany(org),
      SLAPolicy.deleteMany(org), User.deleteMany(org),
    ]);
    await Organization.deleteOne({ _id: existing._id });
  }

  const org = await Organization.create({ name: "Demo Telecom", slug: SLUG });
  const organizationId = org._id;
  const passwordHash = await hashPassword(PASSWORD);

  const [billing, network] = await Department.create([
    { organizationId, name: "Billing" },
    { organizationId, name: "Network" },
  ]);
  const admin = await User.create({ organizationId, name: "Demo Admin", email: "admin@demo.com", passwordHash, role: "ADMIN" });
  const employees = await User.create(
    ["Asha Rao", "Ben Carter", "Chitra Iyer"].map((name, i) => ({
      organizationId, name, email: `${name.split(" ")[0].toLowerCase()}@demo.com`, passwordHash, role: "EMPLOYEE",
      departmentId: i === 1 ? network._id : billing._id,
    }))
  );
  const customers = await User.create(
    Array.from({ length: 10 }, (_, i) => ({
      organizationId, name: `Customer ${i + 1}`, email: `customer${i + 1}@demo.com`, passwordHash, role: "CUSTOMER",
    }))
  );

  const now = Date.now();
  const complaints: Record<string, unknown>[] = [];
  const feedback: Record<string, unknown>[] = [];

  for (let i = 0; i < COMPLAINTS; i++) {
    const _id = new Types.ObjectId();
    const created = new Date(now - rand() * 45 * DAY);
    const priority = pick(PRIORITIES);
    const policy = DEFAULT_POLICIES[priority];
    const due = new Date(created.getTime() + policy.resolutionMinutes * 60_000);
    const employee = pick(employees);
    const customer = pick(customers);
    const roll = rand();
    const history: Record<string, unknown>[] = [{ status: "OPEN", by: customer._id, at: created }];

    let status = "OPEN";
    let assignedTo: Types.ObjectId | null = null;
    let resolvedAt: Date | undefined;
    let closedAt: Date | undefined;
    let firstRespondedAt: Date | undefined;

    if (roll < 0.55) {
      assignedTo = employee._id;
      firstRespondedAt = new Date(created.getTime() + rand() * policy.responseMinutes * 1.4 * 60_000);
      // about 75% finish before their deadline
      const resolvedTime = created.getTime() + policy.resolutionMinutes * 60_000 * (0.15 + rand() * 1.0);
      resolvedAt = new Date(Math.min(resolvedTime, now - 60_000));
      status = rand() < 0.5 ? "CLOSED" : "RESOLVED";
      if (status === "CLOSED") closedAt = new Date(Math.min(resolvedAt.getTime() + DAY, now));
      history.push(
        { status: "ASSIGNED", by: admin._id, at: new Date(created.getTime() + 60_000) },
        { status: "IN_PROGRESS", by: employee._id, at: firstRespondedAt },
        { status: "RESOLVED", by: employee._id, at: resolvedAt, note: "Issue fixed" }
      );
      if (closedAt) history.push({ status: "CLOSED", by: customer._id, at: closedAt });
      if (rand() < 0.45) {
        feedback.push({
          _id: new Types.ObjectId(), organizationId, complaintId: _id, customerId: customer._id,
          rating: 1 + Math.floor(rand() * 5), createdAt: new Date(Math.min(resolvedAt.getTime() + 3_600_000, now)),
        });
      }
    } else if (roll < 0.7) {
      status = "IN_PROGRESS"; assignedTo = employee._id; firstRespondedAt = new Date(created.getTime() + 600_000);
      history.push({ status: "ASSIGNED", by: admin._id, at: created }, { status: "IN_PROGRESS", by: employee._id, at: firstRespondedAt });
    } else if (roll < 0.82) {
      status = "ASSIGNED"; assignedTo = employee._id;
      history.push({ status: "ASSIGNED", by: admin._id, at: new Date(created.getTime() + 60_000) });
    }

    const active = !resolvedAt;
    const escalated = active && due.getTime() < now;

    complaints.push({
      _id, organizationId,
      ticketNo: `RX-${String(i + 1).padStart(6, "0")}`,
      title: pick(TITLES), description: "Seeded demo complaint. This is not real customer data.",
      category: pick(CATEGORIES), priority, status,
      customerId: customer._id, assignedTo,
      departmentId: assignedTo ? (employee.departmentId ?? null) : null,
      attachments: [],
      firstResponseDueAt: new Date(created.getTime() + policy.responseMinutes * 60_000),
      resolutionDueAt: due,
      ...(firstRespondedAt ? { firstRespondedAt } : {}),
      ...(resolvedAt ? { resolvedAt, resolutionNote: "Issue fixed" } : {}),
      ...(closedAt ? { closedAt } : {}),
      isEscalated: escalated,
      ...(escalated ? { escalatedAt: new Date(due.getTime() + 60_000) } : {}),
      escalationHistory: escalated ? [{ at: new Date(due.getTime() + 60_000), reason: "Resolution deadline missed", level: 1 }] : [],
      reopenCount: 0, statusHistory: history,
      createdAt: created, updatedAt: resolvedAt ?? created,
    });
  }

  // Raw inserts keep the historical createdAt values (Mongoose would otherwise stamp "now").
  await Complaint.collection.insertMany(complaints);
  if (feedback.length) await Feedback.collection.insertMany(feedback);
  await Counter.create({ organizationId, key: "complaint", seq: COMPLAINTS });
  await Complaint.init(); // make sure indexes exist

  console.log(`Seeded organization "${SLUG}" with ${COMPLAINTS} complaints (DEMO DATA).`);
  console.log(`Log in with organization "${SLUG}" and password "${PASSWORD}":`);
  console.log("  admin@demo.com | asha@demo.com / ben@demo.com / chitra@demo.com | customer1@demo.com ... customer10@demo.com");
  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
