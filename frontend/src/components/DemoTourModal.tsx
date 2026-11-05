import { useState } from "react";
import { Modal, Button } from "./ui";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import type { Role } from "../types";

interface DemoTourModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    step: 1,
    role: "CUSTOMER" as Role,
    roleTitle: "Customer Experience",
    userProfile: "Alex Morgan (Customer)",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    headline: "Submit, Track & Monitor SLA in Real Time",
    description:
      "Customers experience frictionless complaint reporting with automated category classification, priority tagging, and live countdown timers for first-response and resolution deadlines.",
    checklist: [
      "Navigate to 'New Complaint' and submit a ticket (e.g., Fiber drop or Billing query).",
      "Notice how the SLA resolution timer is computed automatically from priority policies.",
      "Check the 'My Complaints' list and open your ticket to track real-time status history.",
    ],
    buttonText: "Switch to Customer View",
    targetRoute: "/app/complaints/new",
  },
  {
    step: 2,
    role: "EMPLOYEE" as Role,
    roleTitle: "Support Engineer & Staff",
    userProfile: "Asha Rao (Technical Support Lead)",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    headline: "Claim Tickets, Update Priority & Resolve Issues",
    description:
      "Support staff manage prioritized queues, claim unassigned pool complaints with atomic concurrency control, update progress, and post resolution notes.",
    checklist: [
      "Open the unassigned open ticket RX-000101 in 'Assigned complaints'.",
      "Click 'Accept' to claim ownership, then click 'Start work' (sets status to IN_PROGRESS).",
      "Change priority to test dynamic SLA recalculation, or add an internal staff note.",
      "Click 'Resolve' and provide a resolution note to complete the customer request.",
    ],
    buttonText: "Switch to Employee View",
    targetRoute: "/app/complaints",
  },
  {
    step: 3,
    role: "ADMIN" as Role,
    roleTitle: "Operations & Admin",
    userProfile: "Sarah Chen (Director of Operations)",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    headline: "Live Analytics, Automated Escalations & Audit Trail",
    description:
      "Full oversight of organization health: 30-day resolution trends, department performance, employee workload distribution, SLA breach escalations, and tamper-evident audit logs.",
    checklist: [
      "Explore the Dashboard: observe Resolution Rate, SLA Compliance %, and average MTTR.",
      "Inspect the Escalated complaints list (tickets that automatically breached SLA targets).",
      "Open 'Analytics' to review department distributions and staff workload matrices.",
      "Check 'Audit Logs' to verify that every state change and comment was logged with actor metadata.",
    ],
    buttonText: "Switch to Admin View",
    targetRoute: "/app",
  },
];

export function DemoTourModal({ open, onClose }: DemoTourModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user, switchDemoRole, resetDemo } = useAuth();
  const navigate = useNavigate();

  const active = STEPS[currentStep];

  const handleRoleJump = async (role: Role, route: string) => {
    setLoading(true);
    try {
      if (user?.role !== role) {
        await switchDemoRole(role);
      }
      navigate(route);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetDemo();
      navigate("/app");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ResolveX Recruiter Interactive Test Drive"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReset}
            loading={loading}
            title="Restore pristine 25+ demo tickets"
          >
            Reset Demo Data
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            >
              Previous
            </Button>
            {currentStep < STEPS.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
              >
                Next Step
              </Button>
            ) : (
              <Button size="sm" onClick={onClose}>
                Got it
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-xs text-slate-500">
          This interactive tour showcases the complete complaint management lifecycle across 3 distinct roles in under 3 minutes.
        </p>

        {/* Step Indicator Tabs */}
        <div className="flex border-b border-slate-200">
          {STEPS.map((s, idx) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setCurrentStep(idx)}
              className={`flex-1 pb-2.5 text-center text-xs font-semibold transition border-b-2 ${
                currentStep === idx
                  ? "border-brand-600 text-brand-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Step {s.step}: {s.roleTitle}
            </button>
          ))}
        </div>

        {/* Step Details */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${active.badgeColor}`}>
              {active.roleTitle}
            </span>
            <span className="text-xs text-slate-500 font-medium">Logged in as: {active.userProfile}</span>
          </div>

          <h3 className="mt-2 text-base font-bold text-slate-900">{active.headline}</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{active.description}</p>

          <div className="mt-3.5 space-y-1.5 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Recommended Actions to Try:</p>
            <ul className="space-y-1 text-xs text-slate-600">
              {active.checklist.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">Click to switch immediately:</span>
            <Button
              size="sm"
              loading={loading}
              onClick={() => handleRoleJump(active.role, active.targetRoute)}
            >
              {active.buttonText} &rarr;
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Full Continuity:</strong> Actions taken as Customer (like submitting a ticket) will immediately appear when you switch to Employee and Admin. All demo data is strictly isolated to the sandbox tenant.
        </div>
      </div>
    </Modal>
  );
}
