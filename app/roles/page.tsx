"use client";

import Link from "next/link";
import { RolePreviewShell, PreviewHistory } from "@/components/role-preview-shell";
import { useWorkspaceTheme, panelClass, mutedClass, buttonClass } from "@/components/workspace-shell";

export default function RoleMap() {
  const { night } = useWorkspaceTheme();
  return <RolePreviewShell title="Role and handoff map" description="Each role has a different handoff and approval boundary.">
    <div className="grid gap-5 md:grid-cols-2">
      <section className={panelClass(night)}><p className={`text-xs font-bold ${mutedClass(night)}`}>1 · COORDINATOR</p><h2 className="mt-3 text-xl font-semibold">Collect original records</h2><p className="mt-3 text-sm leading-6">Request the missing November 2 note, attach the synthetic source, and hand the complete source set to the clinician.</p><p className={`mt-4 text-xs ${mutedClass(night)}`}>Document operations · Clinical blockers stay with the clinician</p></section>
      <section className={panelClass(night)}><p className={`text-xs font-bold ${mutedClass(night)}`}>2 · CLINICIAN</p><h2 className="mt-3 text-xl font-semibold">Review and sign off</h2><p className="mt-3 text-sm leading-6">Review claims and exact source passages. Verify dates, resolve blockers, recheck the packet, and sign off its exact version.</p><Link href="/cases/UR-1042/summary" className={`${buttonClass} mt-5`}>Open clinician workspace →</Link></section>
      <section className={panelClass(night)}><p className={`text-xs font-bold ${mutedClass(night)}`}>OVERSIGHT · MANAGER</p><h2 className="mt-3 text-xl font-semibold">Assign and route work</h2><p className="mt-3 text-sm leading-6">Monitor the team queue and deadlines. Reassign reviews and route missing-source or incomplete-run escalations for help.</p><p className={`mt-4 text-xs ${mutedClass(night)}`}>Assignment and oversight · No clinical sign-off</p></section>
      <section className={panelClass(night)}><p className={`text-xs font-bold ${mutedClass(night)}`}>3 · SUBMISSION STAFF</p><h2 className="mt-3 text-xl font-semibold">Prepare an approved packet</h2><p className="mt-3 text-sm leading-6">Check that the current packet version and fingerprint match its sign-off. Prepare a demo handoff and record a fictional receipt.</p><p className={`mt-4 text-xs ${mutedClass(night)}`}>Changed packet → fresh clinician review · No payer connection</p></section>
    </div><div className="mt-6"><PreviewHistory /></div>
  </RolePreviewShell>;
}
