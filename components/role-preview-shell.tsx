"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { WorkspaceShell, useWorkspaceTheme, panelClass, mutedClass } from "./workspace-shell";
import { useRolePreview } from "./role-preview-context";

export const rolePreviewLinks = [{ href: "/roles", label: "Role map" }, { href: "/roles/coordinator", label: "Coordinator" }, { href: "/roles/manager", label: "Manager" }, { href: "/roles/submission", label: "Submission staff" }];
export function RolePreviewShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { night } = useWorkspaceTheme();
  const { ready, storageError, reset } = useRolePreview();
  const [confirmReset, setConfirmReset] = useState(false);
  const router = useRouter();
  const path = usePathname();
  return <WorkspaceShell title={`Workspace map / ${title}`} headerDetail="UR-1042 · Synthetic preview">
    <p className={`text-[10px] font-bold tracking-[0.14em] ${mutedClass(night)}`}>ROLE AND HANDOFF PREVIEW · PENPOT</p>
    <h1 className="mt-3 font-serif text-3xl sm:text-4xl">{title}</h1><p className={`mt-2 text-sm ${mutedClass(night)}`}>{description}</p>
    <nav aria-label="Explore role flows" className="mt-6 flex flex-wrap gap-2">{rolePreviewLinks.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined} className={`rounded-lg border px-4 py-2 text-sm ${path === link.href ? "border-[#79a88b] bg-[#649b72]/15 font-semibold" : "border-current/15"}`}>{link.label}</Link>)}<Link href="/cases/UR-1042/summary" className="rounded-lg border border-current/15 px-4 py-2 text-sm">Clinician workspace ↗</Link></nav>
    <div className={`mt-5 rounded-lg border p-4 text-xs leading-5 ${night ? "border-[#76603c] bg-[#443821] text-[#ecdcb9]" : "border-[#e4d4ad] bg-[#fbf5e8] text-[#7c6337]"}`}><strong>Preview roles, not account permissions.</strong> Actions are synthetic examples saved in this browser. They do not update the live clinician case or send records to a payer.</div>
    <div className="mt-3 text-xs">{confirmReset ? <div className="flex flex-wrap items-center gap-3"><span>Reset the local role demo and its sample history?</span><button type="button" onClick={() => { reset(); setConfirmReset(false); router.push("/roles"); }} className="rounded-lg border border-current/20 px-3 py-2 font-semibold">Reset local preview</button><button type="button" onClick={() => setConfirmReset(false)} className="px-3 py-2 underline">Keep current preview</button></div> : <button type="button" disabled={!ready} onClick={() => setConfirmReset(true)} className="rounded-lg px-1 py-2 underline underline-offset-4 disabled:opacity-50">Start a fresh role walkthrough</button>}</div>
    {storageError && <p role="alert" className="mt-3 text-sm text-[#b45f4b]">Browser storage is unavailable. Preview changes may be lost after refresh.</p>}
    {ready ? <div className="mt-7">{children}</div> : <p role="status" className="mt-7">Loading role preview…</p>}
  </WorkspaceShell>;
}
export function PreviewHistory() {
  const { state } = useRolePreview();
  const { night } = useWorkspaceTheme();
  return <section className={panelClass(night)}><h2 className="font-semibold">Preview handoff activity</h2><p className={`mt-2 text-xs ${mutedClass(night)}`}>Local demo events · Not the clinical audit record</p>{state.events.length ? <ol className="mt-4 divide-y divide-current/10">{state.events.map(event => <li key={event.id} className="py-4 text-sm"><strong>{event.actor}</strong><p className="mt-1 leading-6">{event.message}</p><time dateTime={event.at} className={`mt-2 block text-xs ${mutedClass(night)}`}>{new Date(event.at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET · Preview action</time></li>)}</ol> : <p className={`mt-4 text-sm ${mutedClass(night)}`}>No preview handoffs recorded yet.</p>}</section>;
}
