export type Role = "CUSTOMER" | "EMPLOYEE" | "ADMIN";
export type Status = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REOPENED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Category = "BILLING" | "NETWORK" | "SERVICE" | "PRODUCT" | "ACCOUNT" | "OTHER";

export const STATUSES: Status[] = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"];
export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const CATEGORIES: Category[] = ["BILLING", "NETWORK", "SERVICE", "PRODUCT", "ACCOUNT", "OTHER"];

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: string;
  isActive: boolean;
  isDemo?: boolean;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  [key: string]: unknown;
}
export interface Paged<T> {
  items: T[];
  meta: Meta;
}

export interface Ref {
  id: string;
  name: string;
  email?: string;
}

export interface Attachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface Complaint {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  customer: Ref | null;
  assignedTo: Ref | null;
  department: Ref | null;
  attachments: Attachment[];
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  isEscalated: boolean;
  escalatedAt: string | null;
  escalationHistory: { at: string; reason: string; level: number }[];
  reopenCount: number;
  resolutionNote: string | null;
  statusHistory: { status: Status; at: string; note: string | null; by: Ref | null }[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  body: string;
  isInternal: boolean;
  author: { id: string; name: string; role: Role } | null;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  complaintId?: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  settings: { allowCustomerRegistration: boolean; reopenWindowDays: number };
}

export interface SlaPolicy {
  priority: Priority;
  responseMinutes: number;
  resolutionMinutes: number;
}

export interface Summary {
  total: number;
  pending: number;
  resolved: number;
  escalated: number;
  resolutionRate: number | null;
  avgResolutionHours: number | null;
  slaCompliance: number | null;
  firstResponseCompliance: number | null;
  avgFirstResponseHours: number | null;
  avgRating: number | null;
  ratingCount: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface DepartmentStat {
  departmentId: string | null;
  name: string;
  total: number;
  resolved: number;
  escalated: number;
  avgResolutionHours: number | null;
}

export interface TrendPoint {
  date: string;
  created: number;
  resolved: number;
}

export interface WorkloadRow {
  employeeId: string;
  name: string;
  email: string;
  assigned: number;
  inProgress: number;
  open: number;
  escalated: number;
  dueSoon: number;
  resolvedLast7Days: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  entityType: string;
  complaint: { id: string; ticketNo: string } | null;
  changes: { before?: unknown; after?: unknown } | null;
  ip: string | null;
  createdAt: string;
}

export interface FeedbackEntry {
  id: string;
  rating: number;
  comment: string | null;
  complaint: { id: string; ticketNo: string; title: string } | null;
  customer: { id: string; name: string } | null;
  createdAt: string;
}

export interface ComplaintStats {
  total: number;
  byStatus: Record<Status, number>;
  escalated: number;
}
