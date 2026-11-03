import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { cn, humanize } from "../utils/format";
import type { Role } from "../types";

interface NavItem { to: string; label: string; end?: boolean }

const NAV: Record<Role, NavItem[]> = {
  CUSTOMER: [
    { to: "/app", label: "Dashboard", end: true },
    { to: "/app/complaints/new", label: "New complaint" },
    { to: "/app/complaints", label: "My complaints", end: true },
    { to: "/app/notifications", label: "Notifications" },
    { to: "/app/profile", label: "Profile" },
  ],
  EMPLOYEE: [
    { to: "/app", label: "Dashboard", end: true },
    { to: "/app/complaints", label: "Assigned complaints" },
    { to: "/app/workload", label: "Workload" },
    { to: "/app/notifications", label: "Notifications" },
    { to: "/app/profile", label: "Profile" },
  ],
  ADMIN: [
    { to: "/app", label: "Dashboard", end: true },
    { to: "/app/complaints", label: "All complaints" },
    { to: "/app/employees", label: "Employees" },
    { to: "/app/customers", label: "Customers" },
    { to: "/app/departments", label: "Departments" },
    { to: "/app/sla", label: "SLA policies" },
    { to: "/app/analytics", label: "Analytics" },
    { to: "/app/audit-logs", label: "Audit logs" },
    { to: "/app/settings", label: "Organization" },
    { to: "/app/notifications", label: "Notifications" },
    { to: "/app/profile", label: "Profile" },
  ],
};

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { unread, connected } = useRealtime();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const sidebar = (
    <nav className="flex h-full flex-col bg-slate-900 text-slate-300" aria-label="Main navigation">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">R</span>
        <span className="text-lg font-semibold text-white">ResolveX</span>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV[user.role].map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive ? "bg-brand-600 text-white" : "hover:bg-slate-800 hover:text-white")
              }
            >
              {item.label}
              {item.label === "Notifications" && unread > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{unread > 99 ? "99+" : unread}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-slate-800 px-5 py-4">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="text-xs text-slate-400">{humanize(user.role)}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-400" : "bg-slate-600")} aria-hidden="true" />
          {connected ? "Live updates on" : "Live updates off"}
        </p>
        <button
          className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          onClick={async () => { await logout(); navigate("/login"); }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 lg:block"><div className="fixed inset-y-0 w-64">{sidebar}</div></aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button aria-label="Open menu" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => setOpen(true)}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="font-semibold text-slate-900">ResolveX</span>
          <NavLink to="/app/notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={`Notifications, ${unread} unread`}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" /></svg>
            {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
          </NavLink>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
