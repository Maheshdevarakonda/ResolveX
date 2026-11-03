import { Schema, Types, model } from "mongoose";

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = ["BILLING", "NETWORK", "SERVICE", "PRODUCT", "ACCOUNT", "OTHER"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"] as const;
export type Status = (typeof STATUSES)[number];

// Statuses where the complaint still needs work (used by SLA checks, workload, etc.)
export const ACTIVE_STATUSES: Status[] = ["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED"];

export interface IAttachment {
  url: string;
  publicId: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface IStatusHistory {
  status: Status;
  by?: Types.ObjectId | null; // null when the system did it
  at: Date;
  note?: string;
}

export interface IEscalation {
  at: Date;
  reason: string;
  level: number;
}

export interface IComplaint {
  organizationId: Types.ObjectId;
  ticketNo: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  customerId: Types.ObjectId;
  assignedTo?: Types.ObjectId | null;
  departmentId?: Types.ObjectId | null;
  attachments: IAttachment[];
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
  firstRespondedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  isEscalated: boolean;
  escalatedAt?: Date;
  escalationHistory: IEscalation[];
  slaWarnedAt?: Date;
  reopenCount: number;
  resolutionNote?: string;
  statusHistory: IStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 200 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

const statusHistorySchema = new Schema<IStatusHistory>(
  {
    status: { type: String, enum: STATUSES, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, required: true },
    note: { type: String, maxlength: 1000 },
  },
  { _id: false }
);

const escalationSchema = new Schema<IEscalation>(
  {
    at: { type: Date, required: true },
    reason: { type: String, required: true },
    level: { type: Number, required: true },
  },
  { _id: false }
);

const complaintSchema = new Schema<IComplaint>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    ticketNo: { type: String, required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 150 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
    category: { type: String, enum: CATEGORIES, required: true },
    priority: { type: String, enum: PRIORITIES, required: true },
    status: { type: String, enum: STATUSES, required: true, default: "OPEN" },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    attachments: { type: [attachmentSchema], default: [] },
    firstResponseDueAt: { type: Date, required: true },
    resolutionDueAt: { type: Date, required: true },
    firstRespondedAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    isEscalated: { type: Boolean, default: false },
    escalatedAt: { type: Date },
    escalationHistory: { type: [escalationSchema], default: [] },
    slaWarnedAt: { type: Date },
    reopenCount: { type: Number, default: 0 },
    resolutionNote: { type: String, maxlength: 2000 },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

// Indexes match the real query shapes (see docs/ARCHITECTURE.md). Every one starts with
// organizationId because every query is tenant-scoped.
complaintSchema.index({ organizationId: 1, ticketNo: 1 }, { unique: true });
complaintSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
complaintSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });
complaintSchema.index({ organizationId: 1, customerId: 1, createdAt: -1 });
// Used by the SLA background job (it scans across organizations).
complaintSchema.index({ isEscalated: 1, status: 1, resolutionDueAt: 1 });

export const Complaint = model<IComplaint>("Complaint", complaintSchema);
