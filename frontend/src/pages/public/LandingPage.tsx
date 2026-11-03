import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const FEATURES = [
  { title: "One place for every complaint", text: "Customers submit and track issues. Teams stop chasing emails and spreadsheets." },
  { title: "Deadlines that enforce themselves", text: "Set response and resolution targets per priority. Overdue complaints are escalated automatically, exactly once." },
  { title: "Live updates", text: "Assignments, replies and escalations appear instantly through real-time notifications." },
  { title: "Private by design", text: "Every organization is isolated. Role-based access is enforced on the server, and every change is audit-logged." },
  { title: "Analytics that matter", text: "Resolution rate, average resolution time, SLA compliance and workload per employee." },
  { title: "Built for teams", text: "Customers, employees and admins each get a dashboard made for their job." },
];

export default function LandingPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">R</span>
          <span className="text-lg font-semibold text-slate-900">ResolveX</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <Link className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700" to="/app">Open dashboard</Link>
          ) : (
            <>
              <Link className="font-medium text-slate-600 hover:text-slate-900" to="/login">Sign in</Link>
              <Link className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700" to="/register">Create workspace</Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-16 pt-14 text-center">
        <p className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Complaint &amp; service management</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Resolve complaints before they become churn</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          ResolveX gives every organization a private workspace to receive, assign and resolve customer complaints, with SLA tracking and automatic escalation built in.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white shadow-sm hover:bg-brand-700">Create your workspace</Link>
          <Link to="/login" className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">Sign in</Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">Customers: use the registration link your organization gave you.</p>
      </section>

      <section className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="py-8 text-center text-sm text-slate-500">ResolveX</footer>
    </div>
  );
}
