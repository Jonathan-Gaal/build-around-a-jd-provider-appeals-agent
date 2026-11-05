"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useWorkflowReducedMotion } from "@/lib/client/workflow-reduced-motion";

// Presentation only: keys come from real workflow states. No timers or animation
// callbacks can change case state, clear a blocker, or enable an action.
export function WorkflowNotice({ children, className, eventKey, kind = "status", name = "feedback" }: {
  children: ReactNode; className?: string; eventKey: string; kind?: "status" | "alert"; name?: string;
}) {
  const reduced = useWorkflowReducedMotion();
  return <motion.div key={eventKey} role={kind} aria-atomic="true" data-workflow-motion={name} data-motion={reduced ? "reduced" : "standard"}
    initial={reduced ? false : { opacity: 0.75, y: 4 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }} className={className}>{children}</motion.div>;
}

export function WorkflowStatus({ state, children, label, className, name = "status" }: {
  state: string; children: ReactNode; label: string; className?: string; name?: string;
}) {
  const reduced = useWorkflowReducedMotion();
  return <span role="status" aria-live="polite" aria-atomic="true" className={className}>
    <span className="sr-only">{label}: </span><motion.span key={state} data-workflow-motion={name} data-state={state} data-motion={reduced ? "reduced" : "standard"}
      initial={reduced ? false : { opacity: 0.65 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.18 }}>{children}</motion.span>
  </span>;
}

export function WorkflowPanel({ children, className, id, name, state }: { children: ReactNode; className?: string; id?: string; name: string; state: string }) {
  const reduced = useWorkflowReducedMotion();
  return <motion.section id={id} layout={reduced ? false : "position"} initial={false} data-workflow-motion={name} data-state={state} data-motion={reduced ? "reduced" : "standard"}
    transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }} className={className}>{children}</motion.section>;
}

export function WorkflowHighlight({ children, passageKey }: { children: ReactNode; passageKey: string }) {
  const reduced = useWorkflowReducedMotion();
  return <motion.mark key={passageKey} data-workflow-motion="evidence-highlight" data-motion={reduced ? "reduced" : "standard"}
    initial={reduced ? false : { opacity: 0.7 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.22 }}
    className="rounded bg-[#f4df9a] px-0.5 text-[#342f1d]">{children}</motion.mark>;
}

export function WorkflowReveal({ children, className, eventKey, name, label }: { children: ReactNode; className?: string; eventKey: string; name: string; label?: string }) {
  const reduced = useWorkflowReducedMotion();
  return <motion.section key={eventKey} aria-label={label} data-workflow-motion={name} data-motion={reduced ? "reduced" : "standard"}
    initial={reduced ? false : { opacity: 0.8, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }} className={className}>{children}</motion.section>;
}
