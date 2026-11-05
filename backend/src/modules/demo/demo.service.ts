import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import { Organization } from "../../models/Organization";
import { User, Role, toSafeUser, SafeUser } from "../../models/User";
import { Department } from "../../models/Department";
import { Complaint, CATEGORIES, PRIORITIES, Priority, Category, Status } from "../../models/Complaint";
import { Comment } from "../../models/Comment";
import { Counter } from "../../models/Counter";
import { Feedback } from "../../models/Feedback";
import { AuditLog } from "../../models/AuditLog";
import { Notification } from "../../models/Notification";
import { RefreshToken } from "../../models/RefreshToken";
import { SLAPolicy } from "../../models/SLAPolicy";
import { DEFAULT_POLICIES } from "../sla/sla.service";
import { hashPassword } from "../../utils/password";
import {
  getTokenExpiry,
  hashToken,
  signAccessToken,
  signRefreshToken,
} from "../../utils/tokens";
import { logger } from "../../utils/logger";

export const DEMO_ORG_SLUG = "resolvex-demo";
export const DEMO_PASSWORD = "DemoPassword123!";

export interface DemoSessionResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    isDemo: boolean;
  };
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

export async function ensureDemoData(): Promise<void> {
  const existing = await Organization.findOne({ slug: DEMO_ORG_SLUG });
  if (existing) return;
  await seedDemoData();
}

export async function seedDemoData(): Promise<void> {
  logger.info("Seeding isolated demo organization...");
  const existing = await Organization.findOne({ slug: DEMO_ORG_SLUG });
  if (existing) {
    const org = { organizationId: existing._id };
    await Promise.all([
      Comment.deleteMany(org),
      Complaint.deleteMany(org),
      Counter.deleteMany(org),
      Department.deleteMany(org),
      Feedback.deleteMany(org),
      AuditLog.deleteMany(org),
      Notification.deleteMany(org),
      RefreshToken.deleteMany(org),
      SLAPolicy.deleteMany(org),
      User.deleteMany(org),
    ]);
    await Organization.deleteOne({ _id: existing._id });
  }

  const org = await Organization.create({
    name: "ResolveX Live Demo (Telecom & Fiber Corp)",
    slug: DEMO_ORG_SLUG,
    isDemo: true,
    settings: {
      allowCustomerRegistration: true,
      reopenWindowDays: 7,
    },
  });
  const organizationId = org._id;
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // SLA policies
  await Promise.all(
    (Object.entries(DEFAULT_POLICIES) as [Priority, (typeof DEFAULT_POLICIES)[Priority]][]).map(
      ([priority, policy]) =>
        SLAPolicy.create({
          organizationId,
          priority,
          responseMinutes: policy.responseMinutes,
          resolutionMinutes: policy.resolutionMinutes,
        })
    )
  );

  // Departments
  const [techDept, billingDept, networkDept] = await Department.create([
    { organizationId, name: "Technical Support", description: "Hardware, routers, and connectivity diagnostics" },
    { organizationId, name: "Billing & Accounts", description: "Invoices, payment gateways, and recurring plans" },
    { organizationId, name: "Network Engineering", description: "Infrastructure, backhaul routing, and node health" },
  ]);

  // Admin User
  const admin = await User.create({
    organizationId,
    name: "Sarah Chen",
    email: "demo-admin@resolvex.demo",
    passwordHash,
    role: "ADMIN",
    isActive: true,
  });

  // Employee Users
  const leadEmployee = await User.create({
    organizationId,
    name: "Asha Rao",
    email: "demo-employee@resolvex.demo",
    passwordHash,
    role: "EMPLOYEE",
    departmentId: techDept._id,
    isActive: true,
  });

  const empBilling = await User.create({
    organizationId,
    name: "Ben Carter",
    email: "ben@resolvex.demo",
    passwordHash,
    role: "EMPLOYEE",
    departmentId: billingDept._id,
    isActive: true,
  });

  const empNetwork = await User.create({
    organizationId,
    name: "Chitra Iyer",
    email: "chitra@resolvex.demo",
    passwordHash,
    role: "EMPLOYEE",
    departmentId: networkDept._id,
    isActive: true,
  });

  const allEmployees = [leadEmployee, empBilling, empNetwork];

  // Customer Users
  const mainCustomer = await User.create({
    organizationId,
    name: "Alex Morgan",
    email: "demo-customer@resolvex.demo",
    passwordHash,
    role: "CUSTOMER",
    isActive: true,
  });

  const otherCustomers = await User.create([
    { organizationId, name: "David Kim", email: "david.kim@example.com", passwordHash, role: "CUSTOMER", isActive: true },
    { organizationId, name: "Elena Rostova", email: "elena.r@example.com", passwordHash, role: "CUSTOMER", isActive: true },
    { organizationId, name: "Marcus Vance", email: "marcus.v@example.com", passwordHash, role: "CUSTOMER", isActive: true },
    { organizationId, name: "Priya Patel", email: "priya.p@example.com", passwordHash, role: "CUSTOMER", isActive: true },
  ]);

  const allCustomers = [mainCustomer, ...otherCustomers];

  const now = Date.now();
  const complaintsToInsert: Record<string, unknown>[] = [];
  const feedbackToInsert: Record<string, unknown>[] = [];
  const commentsToInsert: Record<string, unknown>[] = [];
  const auditLogsToInsert: Record<string, unknown>[] = [];

  // 1. Featured complaint #1: Submitted by Alex Morgan, OPEN, unassigned -> Perfect for testing Customer -> Employee accept workflow!
  const c1Id = new Types.ObjectId();
  const c1Created = new Date(now - 25 * 60_000); // 25 mins ago
  const c1Policy = DEFAULT_POLICIES.HIGH;
  complaintsToInsert.push({
    _id: c1Id,
    organizationId,
    ticketNo: "RX-000101",
    title: "High packet loss & jitter on Gigabit Fiber during evening hours",
    description: "Every evening between 7 PM and 10 PM, packet loss spikes to 28% and ping exceeds 140ms. Zoom calls drop repeatedly and streaming buffers. Fiber ONT modem has already been power-cycled twice.",
    category: "NETWORK",
    priority: "HIGH",
    status: "OPEN",
    customerId: mainCustomer._id,
    assignedTo: null,
    departmentId: networkDept._id,
    attachments: [],
    firstResponseDueAt: new Date(c1Created.getTime() + c1Policy.responseMinutes * 60_000),
    resolutionDueAt: new Date(c1Created.getTime() + c1Policy.resolutionMinutes * 60_000),
    isEscalated: false,
    reopenCount: 0,
    statusHistory: [{ status: "OPEN", by: mainCustomer._id, at: c1Created }],
    escalationHistory: [],
    createdAt: c1Created,
    updatedAt: c1Created,
  });

  // 2. Featured complaint #2: Assigned to Asha Rao (Lead Employee), IN_PROGRESS -> Perfect for Employee resolve workflow!
  const c2Id = new Types.ObjectId();
  const c2Created = new Date(now - 2 * HOUR);
  const c2Policy = DEFAULT_POLICIES.CRITICAL;
  const c2Responded = new Date(now - 90 * 60_000);
  complaintsToInsert.push({
    _id: c2Id,
    organizationId,
    ticketNo: "RX-000102",
    title: "Optical Network Terminal (ONT) red LOS light flashing - No WAN link",
    description: "The optical fiber indicator turned red this morning. Resetting the device did not restore line signal. Diagnostic LED indicates Loss of Signal (LOS).",
    category: "PRODUCT",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    customerId: otherCustomers[0]._id,
    assignedTo: leadEmployee._id,
    departmentId: techDept._id,
    attachments: [],
    firstResponseDueAt: new Date(c2Created.getTime() + c2Policy.responseMinutes * 60_000),
    resolutionDueAt: new Date(c2Created.getTime() + c2Policy.resolutionMinutes * 60_000),
    firstRespondedAt: c2Responded,
    isEscalated: false,
    reopenCount: 0,
    statusHistory: [
      { status: "OPEN", by: otherCustomers[0]._id, at: c2Created },
      { status: "ASSIGNED", by: admin._id, at: new Date(c2Created.getTime() + 10 * 60_000) },
      { status: "IN_PROGRESS", by: leadEmployee._id, at: c2Responded, note: "Field engineer dispatched to check neighborhood splice box." },
    ],
    escalationHistory: [],
    createdAt: c2Created,
    updatedAt: c2Responded,
  });
  commentsToInsert.push({
    organizationId,
    complaintId: c2Id,
    author: leadEmployee._id,
    body: "Confirmed OTDR scan detects fiber break at 180 meters from junction pedestal. Splice crew ETA 35 minutes.",
    isInternal: true,
    createdAt: new Date(now - 45 * 60_000),
  });
  commentsToInsert.push({
    organizationId,
    complaintId: c2Id,
    author: leadEmployee._id,
    body: "Hello David, our technician has located the signal loss outside your property and is currently replacing the damaged patch cable.",
    isInternal: false,
    createdAt: new Date(now - 40 * 60_000),
  });

  // 3. Featured complaint #3: ESCALATED ticket past SLA deadline -> Shows automated SLA escalation in Admin Dashboard!
  const c3Id = new Types.ObjectId();
  const c3Created = new Date(now - 30 * HOUR);
  const c3Policy = DEFAULT_POLICIES.CRITICAL;
  const c3Due = new Date(c3Created.getTime() + c3Policy.resolutionMinutes * 60_000); // was due 6 hours ago
  complaintsToInsert.push({
    _id: c3Id,
    organizationId,
    ticketNo: "RX-000103",
    title: "Substation distribution switch reboot loop - 48 business accounts offline",
    description: "Core distribution switch in Sector 4 industrial park entering repeated kernel panic loops. Redundant failover link degraded.",
    category: "NETWORK",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    customerId: otherCustomers[1]._id,
    assignedTo: empNetwork._id,
    departmentId: networkDept._id,
    attachments: [],
    firstResponseDueAt: new Date(c3Created.getTime() + c3Policy.responseMinutes * 60_000),
    resolutionDueAt: c3Due,
    firstRespondedAt: new Date(c3Created.getTime() + 20 * 60_000),
    isEscalated: true,
    escalatedAt: new Date(c3Due.getTime() + 60_000),
    reopenCount: 0,
    statusHistory: [
      { status: "OPEN", by: otherCustomers[1]._id, at: c3Created },
      { status: "ASSIGNED", by: admin._id, at: new Date(c3Created.getTime() + 5 * 60_000) },
      { status: "IN_PROGRESS", by: empNetwork._id, at: new Date(c3Created.getTime() + 20 * 60_000) },
    ],
    escalationHistory: [
      { at: new Date(c3Due.getTime() + 60_000), reason: "Resolution deadline missed (CRITICAL SLA 24h exceeded)", level: 1 },
    ],
    createdAt: c3Created,
    updatedAt: new Date(c3Due.getTime() + 60_000),
  });

  // 4. Featured complaint #4: RESOLVED ticket by Alex Morgan with customer feedback -> Shows feedback & closed state!
  const c4Id = new Types.ObjectId();
  const c4Created = new Date(now - 3 * DAY);
  const c4Policy = DEFAULT_POLICIES.MEDIUM;
  const c4Resolved = new Date(c4Created.getTime() + 3 * HOUR);
  complaintsToInsert.push({
    _id: c4Id,
    organizationId,
    ticketNo: "RX-000104",
    title: "Double charge on monthly recurring invoice #INV-8890",
    description: "My auto-debit charge was billed twice on the 1st of the month ($79.99 x 2). Requesting immediate refund of the duplicate amount.",
    category: "BILLING",
    priority: "MEDIUM",
    status: "RESOLVED",
    customerId: mainCustomer._id,
    assignedTo: empBilling._id,
    departmentId: billingDept._id,
    attachments: [],
    firstResponseDueAt: new Date(c4Created.getTime() + c4Policy.responseMinutes * 60_000),
    resolutionDueAt: new Date(c4Created.getTime() + c4Policy.resolutionMinutes * 60_000),
    firstRespondedAt: new Date(c4Created.getTime() + 45 * 60_000),
    resolvedAt: c4Resolved,
    resolutionNote: "Duplicate transaction identified with payment gateway. $79.99 refund issued to original card ending in 4109. Refund reference #RFND-3910.",
    isEscalated: false,
    reopenCount: 0,
    statusHistory: [
      { status: "OPEN", by: mainCustomer._id, at: c4Created },
      { status: "ASSIGNED", by: admin._id, at: new Date(c4Created.getTime() + 30 * 60_000) },
      { status: "IN_PROGRESS", by: empBilling._id, at: new Date(c4Created.getTime() + 45 * 60_000) },
      { status: "RESOLVED", by: empBilling._id, at: c4Resolved, note: "Refund processed and receipt generated." },
    ],
    escalationHistory: [],
    createdAt: c4Created,
    updatedAt: c4Resolved,
  });
  feedbackToInsert.push({
    _id: new Types.ObjectId(),
    organizationId,
    complaintId: c4Id,
    customerId: mainCustomer._id,
    rating: 5,
    comment: "Refund reflected in my bank within 2 hours. Exceptional resolution time!",
    createdAt: new Date(c4Resolved.getTime() + HOUR),
  });

  // 5. Featured complaint #5: Second open ticket for Alex Morgan -> Shows list view filtering
  const c5Id = new Types.ObjectId();
  const c5Created = new Date(now - 5 * HOUR);
  const c5Policy = DEFAULT_POLICIES.LOW;
  complaintsToInsert.push({
    _id: c5Id,
    organizationId,
    ticketNo: "RX-000105",
    title: "Static IPv4 allocation request for home laboratory server",
    description: "Need a fixed IP assigned to MAC address 00:1A:2B:3C:4D:5E for remote VPN hosting and port forwarding.",
    category: "SERVICE",
    priority: "LOW",
    status: "ASSIGNED",
    customerId: mainCustomer._id,
    assignedTo: leadEmployee._id,
    departmentId: techDept._id,
    attachments: [],
    firstResponseDueAt: new Date(c5Created.getTime() + c5Policy.responseMinutes * 60_000),
    resolutionDueAt: new Date(c5Created.getTime() + c5Policy.resolutionMinutes * 60_000),
    firstRespondedAt: new Date(c5Created.getTime() + 50 * 60_000),
    isEscalated: false,
    reopenCount: 0,
    statusHistory: [
      { status: "OPEN", by: mainCustomer._id, at: c5Created },
      { status: "ASSIGNED", by: leadEmployee._id, at: new Date(c5Created.getTime() + 50 * 60_000) },
    ],
    escalationHistory: [],
    createdAt: c5Created,
    updatedAt: new Date(c5Created.getTime() + 50 * 60_000),
  });

  // Additional 20 historical complaints to populate the charts, trends, and department analytics realistically
  const SAMPLE_TITLES: [string, Category, Priority][] = [
    ["Broadband modem disconnects intermittently after heavy rain", "PRODUCT", "MEDIUM"],
    ["Incorrect tariff plan billed following annual upgrade", "BILLING", "MEDIUM"],
    ["Port forwarding not persisting after router firmware update", "PRODUCT", "LOW"],
    ["Cannot access customer self-service portal", "ACCOUNT", "HIGH"],
    ["Fiber line severed by road construction crew", "NETWORK", "CRITICAL"],
    ["Request for commercial service level agreement documentation", "SERVICE", "LOW"],
    ["VPN throughput capped at 10 Mbps on symmetric fiber", "NETWORK", "MEDIUM"],
    ["Duplicate promo discount revoked without notice", "BILLING", "LOW"],
    ["DNS lookup failures on primary ISP gateway", "NETWORK", "HIGH"],
    ["New static IP block subnet routing error", "SERVICE", "HIGH"],
    ["Wi-Fi 6 mesh node fails to sync backhaul with master router", "PRODUCT", "MEDIUM"],
    ["Payment gateway timeout charged customer credit card twice", "BILLING", "HIGH"],
    ["Enterprise SIP trunk registration failing with SIP 403", "SERVICE", "CRITICAL"],
    ["Two-factor authentication SMS verification codes delayed", "ACCOUNT", "HIGH"],
    ["Requesting equipment relocation to new office suite", "SERVICE", "LOW"],
    ["High packet loss reported across East zone distribution ring", "NETWORK", "HIGH"],
    ["Unexplained overage charges on unlimited enterprise data tier", "BILLING", "MEDIUM"],
    ["Static lease reservation conflicts with DHCP pool range", "PRODUCT", "LOW"],
    ["Fiber drop cable hanging low across residential driveway", "NETWORK", "MEDIUM"],
    ["Password reset verification email not received by domain admin", "ACCOUNT", "MEDIUM"],
  ];

  for (let i = 0; i < SAMPLE_TITLES.length; i++) {
    const [title, category, priority] = SAMPLE_TITLES[i];
    const ticketNo = `RX-000${String(106 + i).padStart(3, "0")}`;
    const _id = new Types.ObjectId();
    const ageDays = 1 + (i % 28);
    const created = new Date(now - ageDays * DAY - (i * 37 * 60_000));
    const policy = DEFAULT_POLICIES[priority];
    const emp = allEmployees[i % allEmployees.length];
    const cust = allCustomers[i % allCustomers.length];
    const resHours = 2 + (i % 5);
    const resolvedAt = new Date(created.getTime() + resHours * HOUR);
    const isClosed = i % 2 === 0;
    const status: Status = isClosed ? "CLOSED" : "RESOLVED";

    complaintsToInsert.push({
      _id,
      organizationId,
      ticketNo,
      title,
      description: `[DEMO DATA - Sample Record] Verified customer report regarding ${title.toLowerCase()}. Resolved by support engineering according to standard operating procedure.`,
      category,
      priority,
      status,
      customerId: cust._id,
      assignedTo: emp._id,
      departmentId: emp.departmentId ?? techDept._id,
      attachments: [],
      firstResponseDueAt: new Date(created.getTime() + policy.responseMinutes * 60_000),
      resolutionDueAt: new Date(created.getTime() + policy.resolutionMinutes * 60_000),
      firstRespondedAt: new Date(created.getTime() + 25 * 60_000),
      resolvedAt,
      resolutionNote: "Root cause addressed and verification completed with customer.",
      ...(isClosed ? { closedAt: new Date(resolvedAt.getTime() + 12 * HOUR) } : {}),
      isEscalated: false,
      reopenCount: 0,
      statusHistory: [
        { status: "OPEN", by: cust._id, at: created },
        { status: "ASSIGNED", by: admin._id, at: new Date(created.getTime() + 15 * 60_000) },
        { status: "IN_PROGRESS", by: emp._id, at: new Date(created.getTime() + 25 * 60_000) },
        { status: "RESOLVED", by: emp._id, at: resolvedAt, note: "Corrective action applied." },
        ...(isClosed ? [{ status: "CLOSED", by: cust._id, at: new Date(resolvedAt.getTime() + 12 * HOUR) }] : []),
      ],
      escalationHistory: [],
      createdAt: created,
      updatedAt: resolvedAt,
    });

    if (i % 3 === 0) {
      feedbackToInsert.push({
        _id: new Types.ObjectId(),
        organizationId,
        complaintId: _id,
        customerId: cust._id,
        rating: 4 + (i % 2),
        comment: i % 2 === 0 ? "Fast resolution, very satisfied." : "Helpful and polite representative.",
        createdAt: new Date(resolvedAt.getTime() + 2 * HOUR),
      });
    }

    auditLogsToInsert.push({
      organizationId,
      actor: { id: String(emp._id), name: emp.name, role: emp.role },
      action: "COMPLAINT_RESOLVED",
      entityType: "COMPLAINT",
      entityId: _id,
      complaintId: _id,
      changes: { before: { status: "IN_PROGRESS" }, after: { status: "RESOLVED" } },
      createdAt: resolvedAt,
    });
  }

  // Insert collections
  await Complaint.collection.insertMany(complaintsToInsert);
  if (commentsToInsert.length) await Comment.collection.insertMany(commentsToInsert);
  if (feedbackToInsert.length) await Feedback.collection.insertMany(feedbackToInsert);
  if (auditLogsToInsert.length) await AuditLog.collection.insertMany(auditLogsToInsert);
  await Counter.create({ organizationId, key: "complaint", seq: 105 + SAMPLE_TITLES.length });

  logger.info(`Successfully seeded demo organization with ${complaintsToInsert.length} complaints.`);
}

export async function getDemoSession(role: Role = "CUSTOMER"): Promise<DemoSessionResult> {
  await ensureDemoData();

  const org = await Organization.findOne({ slug: DEMO_ORG_SLUG }).lean();
  if (!org) throw new Error("Demo organization could not be initialized");

  let user = await User.findOne({ organizationId: org._id, role, isActive: true }).lean();
  if (!user) {
    // If not found (e.g. data modified), re-seed and fetch
    await seedDemoData();
    user = await User.findOne({ organizationId: org._id, role, isActive: true }).lean();
  }
  if (!user) throw new Error(`Demo user for role ${role} not found`);

  const subject = {
    id: String(user._id),
    organizationId: String(org._id),
    role: user.role,
  };

  const family = crypto.randomUUID();
  const accessToken = signAccessToken({
    sub: subject.id,
    orgId: subject.organizationId,
    role: subject.role,
  });
  const refreshToken = signRefreshToken({
    sub: subject.id,
    orgId: subject.organizationId,
    family,
  });

  await RefreshToken.create({
    userId: new Types.ObjectId(subject.id),
    organizationId: new Types.ObjectId(subject.organizationId),
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: getTokenExpiry(refreshToken),
  });

  const safeUser = toSafeUser({
    ...user,
    isDemo: true,
  });

  return {
    user: safeUser,
    accessToken,
    refreshToken,
    organization: {
      id: String(org._id),
      name: org.name,
      slug: org.slug,
      isDemo: true,
    },
  };
}

export async function resetDemoSession(): Promise<DemoSessionResult> {
  await seedDemoData();
  return getDemoSession("CUSTOMER");
}
