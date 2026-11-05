import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import type { Role } from "../../types";

const FEATURES = [
  { title: "One place for every complaint", text: "Customers submit and track issues. Teams stop chasing emails and spreadsheets." },
  { title: "Deadlines that enforce themselves", text: "Set response and resolution targets per priority. Overdue complaints are escalated automatically, exactly once." },
  { title: "Live updates", text: "Assignments, replies and escalations appear instantly through real-time notifications." },
  { title: "Private by design", text: "Every organization is isolated. Role-based access is enforced on the server, and every change is audit-logged." },
  { title: "Analytics that matter", text: "Resolution rate, average resolution time, SLA compliance and workload per employee." },
  { title: "Built for teams", text: "Customers, employees and admins each get a dashboard made for their job." },
];

const DEMO_PREVIEWS: { role: Role; title: string; desc: string; icon: string; persona: string }[] = [
  {
    role: "CUSTOMER",
    title: "Customer Portal",
    persona: "Alex Morgan",
    desc: "Submit a sample ticket, view automated SLA countdowns, and track resolution progress.",
    icon: "👤",
  },
  {
    role: "EMPLOYEE",
    title: "Support Engineering",
    persona: "Asha Rao (Tech Lead)",
    desc: "Claim unassigned complaints, adjust priority, add internal tech notes, and resolve tickets.",
    icon: "🛠️",
  },
  {
    role: "ADMIN",
    title: "Operations & Analytics",
    persona: "Sarah Chen (Director)",
    desc: "Monitor 30-day trends, department workload, automated SLA escalations, and audit logs.",
    icon: "📊",
  },
];

export default function LandingPage() {
  const { user, enterDemo } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState<Role | null>(null);

  const startDemo = async (role: Role = "CUSTOMER") => {
    setDemoLoading(role);
    try {
      await enterDemo(role);
      toast.success(`Welcome to Demo Mode as ${role.toLowerCase()}!`);
      navigate("/app");
    } catch {
      toast.error("Could not initialize demo. Please check connection.");
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white shadow-sm">R</span>
          <span className="text-lg font-semibold text-slate-900 tracking-tight">ResolveX</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <Link className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 transition" to="/app">
              Open dashboard
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => startDemo("CUSTOMER")}
                disabled={demoLoading !== null}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/70 px-3.5 py-1.5 font-medium text-brand-700 hover:bg-brand-100 transition"
              >
                <span>▶</span>
                <span>{demoLoading ? "Starting Demo..." : "Explore Live Demo"}</span>
              </button>
              <Link className="font-medium text-slate-600 hover:text-slate-900 px-2 py-1" to="/login">
                Sign in
              </Link>
              <Link className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 transition shadow-sm" to="/register">
                Create workspace
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-5 pb-16 pt-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
          Intelligent Multi-Tenant Complaint Management
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl sm:leading-tight">
          Resolve complaints before <br className="hidden sm:inline" />
          they become <span className="bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">churn</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 leading-relaxed">
          ResolveX gives modern teams a private workspace to capture, assign, and resolve customer complaints with automated SLA tracking, breach escalation, and real-time audit trails.
        </p>

        {/* Primary Interactive Demo CTA */}
        <div className="mt-8 flex flex-col items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => startDemo("CUSTOMER")}
            disabled={demoLoading !== null}
            className="group relative inline-flex items-center gap-3.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur transition-transform group-hover:scale-110">
              {demoLoading ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="h-4 w-4 fill-current text-white translate-x-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </span>
            <span>{demoLoading ? "Preparing Live Demo..." : "Explore Live Demo"}</span>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-normal text-white/90">
              Recruiter Preview
            </span>
          </button>

          <p className="text-xs text-slate-500 flex items-center gap-2">
            <span>⚡ Instant test drive</span>
            <span>•</span>
            <span>No registration or account needed</span>
            <span>•</span>
            <span>Pre-populated sample data</span>
          </p>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link to="/register" className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              Create your workspace
            </Link>
            <Link to="/login" className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
              Sign in to existing org
            </Link>
          </div>
        </div>
      </section>

      {/* Recruiter 3-Role Demo Showcase */}
      <section className="border-y border-slate-200/80 bg-slate-50/80 py-14">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight sm:text-3xl">
              Experience ResolveX across 3 roles
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Jump directly into any perspective. All roles share the same isolated demo database with real-time updates:
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {DEMO_PREVIEWS.map((dp) => (
              <div
                key={dp.role}
                className="card flex flex-col justify-between p-6 transition hover:shadow-md border-slate-200 bg-white"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{dp.icon}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                      {dp.role}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">{dp.title}</h3>
                  <p className="text-xs text-brand-600 font-medium">Logged in as: {dp.persona}</p>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">{dp.desc}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={demoLoading !== null}
                    onClick={() => startDemo(dp.role)}
                    className="w-full rounded-lg bg-slate-900 hover:bg-brand-600 text-white px-3 py-2 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <span>Launch {dp.title}</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-xl font-bold text-slate-900 mb-8 text-center sm:text-2xl">
            Everything an enterprise needs to resolve service complaints
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6">
                <h3 className="font-semibold text-slate-900 text-base">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        ResolveX — Intelligent Multi-Tenant Complaint &amp; Service Management Platform
      </footer>
    </div>
  );
}
