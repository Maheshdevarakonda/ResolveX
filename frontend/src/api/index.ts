import { api } from "./client";
import type {
  AppNotification, AuditEntry, Category, Comment, Complaint, ComplaintStats, Department, DepartmentStat,
  FeedbackEntry, Organization, Paged, Priority, Role, SlaPolicy, Status, Summary, TrendPoint, User, WorkloadRow,
} from "../types";

type Params = Record<string, string | number | boolean | undefined>;
const clean = (params: Params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));

async function paged<T>(url: string, params?: Params): Promise<Paged<T> & { raw: Record<string, unknown> }> {
  const res = await api.get(url, { params: clean(params) });
  return { items: res.data.data as T[], meta: res.data.meta, raw: res.data };
}

export const authApi = {
  login: (body: { organizationSlug: string; email: string; password: string }) => api.post("/auth/login", body).then((r) => r.data.data),
  registerOrg: (body: { organizationName: string; organizationSlug: string; name: string; email: string; password: string }) =>
    api.post("/auth/register-org", body).then((r) => r.data.data),
  registerCustomer: (body: { organizationSlug: string; name: string; email: string; password: string }) =>
    api.post("/auth/register", body).then((r) => r.data.data),
  logout: () => api.post("/auth/logout").then(() => undefined),
  forgot: (body: { organizationSlug: string; email: string }) => api.post("/auth/forgot-password", body).then((r) => r.data.message as string),
  reset: (body: { token: string; password: string }) => api.post("/auth/reset-password", body).then((r) => r.data.message as string),
};

export interface ComplaintFilters extends Params {
  page?: number; limit?: number; status?: Status | ""; priority?: Priority | ""; category?: Category | "";
  q?: string; sort?: "newest" | "oldest" | "due"; isEscalated?: boolean; assignedTo?: string;
}

export const complaintApi = {
  list: (params?: ComplaintFilters) => paged<Complaint>("/complaints", params),
  stats: () => api.get("/complaints/stats").then((r) => r.data.data as ComplaintStats),
  get: (id: string) => api.get(`/complaints/${id}`).then((r) => r.data.data.complaint as Complaint),
  create: (body: { title: string; description: string; category: Category; priority: Priority }) =>
    api.post("/complaints", body).then((r) => r.data.data.complaint as Complaint),
  assign: (id: string, employeeId: string) => api.patch(`/complaints/${id}/assign`, { employeeId }).then((r) => r.data.data.complaint as Complaint),
  accept: (id: string) => api.post(`/complaints/${id}/accept`).then((r) => r.data.data.complaint as Complaint),
  setStatus: (id: string, status: "IN_PROGRESS" | "RESOLVED", note?: string) =>
    api.patch(`/complaints/${id}/status`, { status, note }).then((r) => r.data.data.complaint as Complaint),
  setPriority: (id: string, priority: Priority) =>
    api.patch(`/complaints/${id}/priority`, { priority }).then((r) => r.data.data.complaint as Complaint),
  close: (id: string) => api.post(`/complaints/${id}/close`).then((r) => r.data.data.complaint as Complaint),
  reopen: (id: string, reason: string) => api.post(`/complaints/${id}/reopen`, { reason }).then((r) => r.data.data.complaint as Complaint),
  comments: (id: string) => api.get(`/complaints/${id}/comments`).then((r) => r.data.data as Comment[]),
  addComment: (id: string, body: string, isInternal: boolean) =>
    api.post(`/complaints/${id}/comments`, { body, isInternal }).then((r) => r.data.data.comment as Comment),
  upload: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return api.post(`/complaints/${id}/attachments`, form).then((r) => r.data.data.complaint as Complaint);
  },
  feedback: (id: string) => api.get(`/complaints/${id}/feedback`).then((r) => r.data.data.feedback as { rating: number; comment: string | null } | null),
  sendFeedback: (id: string, rating: number, comment?: string) => api.post(`/complaints/${id}/feedback`, { rating, comment }),
};

export const userApi = {
  list: (params?: Params & { role?: Role; isActive?: boolean; q?: string; page?: number; limit?: number }) => paged<User>("/users", params),
  createEmployee: (body: { name: string; email: string; password: string; departmentId?: string }) =>
    api.post("/users/employees", body).then((r) => r.data.data.user as User),
  update: (id: string, body: { name?: string; departmentId?: string | null; isActive?: boolean }) =>
    api.patch(`/users/${id}`, body).then((r) => r.data.data.user as User),
  updateMe: (name: string) => api.patch("/users/me", { name }).then((r) => r.data.data.user as User),
};

export const departmentApi = {
  list: () => api.get("/departments").then((r) => r.data.data as Department[]),
  create: (body: { name: string; description?: string }) => api.post("/departments", body).then((r) => r.data.data.department as Department),
  update: (id: string, body: { name?: string; description?: string }) => api.patch(`/departments/${id}`, body).then((r) => r.data.data.department as Department),
  remove: (id: string) => api.delete(`/departments/${id}`).then(() => undefined),
};

export const organizationApi = {
  get: () => api.get("/organization").then((r) => r.data.data.organization as Organization),
  update: (body: { name?: string; settings?: Partial<Organization["settings"]> }) =>
    api.patch("/organization", body).then((r) => r.data.data.organization as Organization),
};

export const slaApi = {
  list: () => api.get("/sla-policies").then((r) => r.data.data as SlaPolicy[]),
  save: (policies: SlaPolicy[]) => api.put("/sla-policies", { policies }).then((r) => r.data.data as SlaPolicy[]),
};

export const analyticsApi = {
  summary: () => api.get("/analytics/summary").then((r) => r.data.data as Summary),
  byDepartment: () => api.get("/analytics/by-department").then((r) => r.data.data as DepartmentStat[]),
  trends: (days = 30) => api.get("/analytics/trends", { params: { days } }).then((r) => r.data.data as TrendPoint[]),
  workload: () => api.get("/analytics/workload").then((r) => r.data.data as WorkloadRow[]),
};

export const auditApi = {
  list: (params?: Params) => paged<AuditEntry>("/audit-logs", params),
};

export const feedbackApi = {
  list: (page = 1) => paged<FeedbackEntry>("/feedback", { page, limit: 10 }),
};

export const notificationApi = {
  list: (params?: { page?: number; limit?: number; unread?: boolean }) => paged<AppNotification>("/notifications", params),
  read: (id: string) => api.patch(`/notifications/${id}/read`).then(() => undefined),
  readAll: () => api.patch("/notifications/read-all").then(() => undefined),
};

export const demoApi = {
  createSession: (role: Role = "CUSTOMER") =>
    api.post("/demo/session", { role }).then((r) => r.data.data as { user: User; accessToken: string; organization: { id: string; name: string; slug: string; isDemo: boolean } }),
  reset: () =>
    api.post("/demo/reset", {}).then((r) => r.data.data as { user: User; accessToken: string; organization: { id: string; name: string; slug: string; isDemo: boolean } }),
};
