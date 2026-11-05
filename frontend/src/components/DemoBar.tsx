import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { DemoTourModal } from "./DemoTourModal";
import type { Role } from "../types";

const ROLES_INFO: { role: Role; label: string; name: string; icon: string }[] = [
  { role: "CUSTOMER", label: "Customer", name: "Alex Morgan", icon: "👤" },
  { role: "EMPLOYEE", label: "Employee", name: "Asha Rao", icon: "🛠️" },
  { role: "ADMIN", label: "Admin", name: "Sarah Chen", icon: "📊" },
];

export function DemoBar() {
  const { user, isDemoMode, switchDemoRole, resetDemo, exitDemo } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  if (!isDemoMode || !user) return null;

  const currentRole = user.role;

  const handleSwitch = async (role: Role) => {
    if (role === currentRole || switching) return;
    setSwitching(true);
    try {
      await switchDemoRole(role);
      toast.info(`Switched to ${role.toLowerCase()} demo view`);
      // If customer switches from admin page, navigate to safe root
      navigate("/app");
    } catch {
      toast.error("Failed to switch demo role");
    } finally {
      setSwitching(false);
    }
  };

  const handleReset = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      await resetDemo();
      toast.success("Demo data reset to fresh baseline!");
      navigate("/app");
    } catch {
      toast.error("Failed to reset demo data");
    } finally {
      setSwitching(false);
    }
  };

  const handleExit = async () => {
    await exitDemo();
    navigate("/");
  };

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-indigo-900/40 bg-slate-900 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs sm:px-4 sm:py-2.5">
          {/* Badge & Mode description */}
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="font-bold tracking-wider uppercase text-amber-400">Demo Mode</span>
            <span className="hidden text-slate-400 sm:inline">•</span>
            <span className="hidden text-slate-300 md:inline">
              Simulating <span className="font-semibold text-white">{user.name}</span> ({user.role})
            </span>
          </div>

          {/* Role Switcher Buttons */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-800/90 p-1 border border-slate-700/60">
            <span className="hidden px-2 text-[11px] font-semibold text-slate-400 lg:inline">Switch Role:</span>
            {ROLES_INFO.map((r) => {
              const active = currentRole === r.role;
              return (
                <button
                  key={r.role}
                  type="button"
                  disabled={switching}
                  onClick={() => handleSwitch(r.role)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    active
                      ? "bg-brand-600 text-white shadow-sm ring-1 ring-white/20"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                  title={`Switch to ${r.label} (${r.name})`}
                >
                  <span>{r.icon}</span>
                  <span>{r.label}</span>
                  <span className="hidden text-[10px] opacity-75 sm:inline">({r.name.split(" ")[0]})</span>
                </button>
              );
            })}
          </div>

          {/* Quick Actions: Walkthrough, Reset, Exit */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="flex items-center gap-1 rounded-md bg-indigo-600/80 hover:bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition border border-indigo-500/40"
              title="View the 3-minute recruiter walkthrough"
            >
              <span>🎓</span>
              <span className="hidden sm:inline">Quick Tour</span>
            </button>

            <button
              type="button"
              disabled={switching}
              onClick={handleReset}
              className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 transition border border-slate-700"
              title="Reset sample data back to baseline"
            >
              <span className={switching ? "animate-spin" : ""}>🔄</span>
              <span className="hidden sm:inline">Reset Demo</span>
            </button>

            <button
              type="button"
              onClick={handleExit}
              className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-red-900/60 hover:text-red-200 px-2 py-1 text-xs font-medium text-slate-300 transition border border-slate-700"
              title="Exit demo mode and return to landing page"
            >
              <span>✕</span>
              <span className="hidden md:inline">Exit</span>
            </button>
          </div>
        </div>
      </div>

      <DemoTourModal open={tourOpen} onClose={() => setTourOpen(false)} />
    </>
  );
}
