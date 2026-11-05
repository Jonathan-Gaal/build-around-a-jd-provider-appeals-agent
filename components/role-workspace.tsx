"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, readApi, writeApi } from "@/lib/client/api";
import type { CaseDetail, CaseSummary, DocumentSummary, Issue } from "@/lib/client/types";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { WorkspaceShell, useWorkspaceTheme, panelClass, buttonClass, mutedClass } from "./workspace-shell";
import { formatDate, statusLabel } from "./case-workspace";

type StaffRole = "coordinator" | "supervisor" | "packet_staff";
type TeamMember = { id: string; name: string; role: string };
type Packet = { caseId: string; packetVersionId: string; version: number; contentHash: string; approval: { id: string; approvedBy: string; createdAt: string }; claims: { id: string; text: string; sectionHeading: string }[] };
type Detail = CaseDetail & { case: CaseDetail["case"] & { assignedTo: string } };
type Selected = { summary: CaseSummary; detail: Detail | null; documents: DocumentSummary[]; issues: Issue[]; team: TeamMember[]; packet: Packet | null };
const descriptions: Record<StaffRole, string> = { coordinator: "Collect original records and hand them to the clinician for verification.", supervisor: "Monitor your assigned team cases and route work to an eligible clinician.", packet_staff: "Read the current signed-off packet. Changed or blocked packets require fresh clinician review." };
export function RoleWorkspace({ role }: { role: StaffRole }) {
  const router = useRouter();
  const { night } = useWorkspaceTheme();
  const panel = panelClass(night), muted = mutedClass(night);
  const [cases, setCases] = useState<CaseSummary[]>([]), [selected, setSelected] = useState<Selected | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState(""), [source, setSource] = useState<string | null>(null);
  const sequence = useRef(0);
  const load = useCallback(async (caseId?: string) => {
    const id = ++sequence.current; setLoading(true); setError(null); setSelected(null); setSource(null);
    try {
      const rows = await readApi<CaseSummary[]>("/api/cases");
      const summary = rows.find(row => row.id === caseId) ?? rows[0];
      let next: Selected | null = null;
      if (summary) {
        const base = `/api/cases/${encodeURIComponent(summary.id)}`;
        if (role === "packet_staff") next = { summary, detail: null, documents: [], issues: [], team: [], packet: await readApi<Packet>(`${base}/packet`) };
        else {
          const [detail, documents, issues, team] = await Promise.all([readApi<Detail>(base), readApi<DocumentSummary[]>(`${base}/documents`), readApi<Issue[]>(`${base}/issues`), role === "supervisor" ? readApi<TeamMember[]>(`${base}/team`) : Promise.resolve([])]);
          next = { summary, detail, documents, issues, team, packet: null };
        }
      }
      if (id === sequence.current) { setCases(rows); setSelected(next); setTarget(next?.detail?.case.assignedTo ?? ""); }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) router.replace("/login");
      if (id === sequence.current) setError(cause instanceof ApiError && cause.status === 409 ? "The packet is no longer signed off. Refresh to see the current queue." : "Workspace could not load. Refresh to try again.");
    } finally { if (id === sequence.current) setLoading(false); }
  }, [role, router]);
  useEffect(() => { const requests = sequence; void load(); const refresh = () => { void load(); }; window.addEventListener("focus", refresh); return () => { requests.current++; window.removeEventListener("focus", refresh); }; }, [load]);
  async function upload(file: File | undefined) {
    if (!file || !selected) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      if (file.size > 120000 || !/\.(md|txt)$/i.test(file.name)) throw new Error("Use the existing synthetic Markdown or text fixture.");
      const raw = await file.text();
      const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
      await writeApi(`/api/cases/${selected.summary.id}/documents`, "POST", { type: "progress_note", title: "Synthetic progress note", content });
      await load(selected.summary.id); setMessage("Original source attached. It remains unverified until a clinician reviews it; clinical issues remain open.");
    } catch (cause) { setError(cause instanceof ApiError ? "Attachment refused. Use the allowlisted synthetic November 2 note." : cause instanceof Error ? cause.message : "Attachment failed."); }
    finally { setBusy(false); }
  }
  async function readSource(documentId: string) {
    const request = sequence.current; setSource(null);
    try { const value = await readApi<{ content: string }>(`/api/documents/${documentId}`); if (request === sequence.current) setSource(value.content); }
    catch { if (request === sequence.current) setError("Source could not load."); }
  }
  async function assign() {
    if (!selected?.detail) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await writeApi(`/api/cases/${selected.summary.id}/assignment`, "PATCH", { assignedTo: target, expectedAssignedTo: selected.detail.case.assignedTo });
      await load(selected.summary.id); setMessage("Assignment saved. Access follows the new assignment; any previous sign-off requires fresh clinician review.");
    } catch (cause) { setError(cause instanceof ApiError && cause.status === 409 ? "Assignment changed or a run is active. Refresh before assigning." : "Assignment could not be saved."); }
    finally { setBusy(false); }
  }
  return <WorkspaceShell title={`${ROLE_LABELS[role]} workspace`}>
    <p className={`text-xs font-semibold tracking-widest ${muted}`}>SYNTHETIC TEAM WORKSPACE</p><h1 className="mt-3 font-serif text-3xl sm:text-4xl">{role === "coordinator" ? "Records and handoffs" : role === "supervisor" ? "Team queue and assignments" : "Signed-off packets"}</h1>
    <p className={`mt-3 text-sm ${muted}`}>{descriptions[role]}</p><button type="button" onClick={() => { setMessage(null); void load(selected?.summary.id); }} disabled={loading || busy} className="mt-5 rounded-lg border border-current/20 px-4 py-2 text-sm disabled:opacity-50">Refresh workspace</button>
    {error && <p role="alert" className="mt-4 rounded-lg border border-[#bd7859] p-4 text-sm">{error}</p>}{message && <p role="status" className="mt-4 rounded-lg bg-[#649b72]/15 p-4 text-sm">{message}</p>}
    {loading ? <p role="status" className="mt-7">Loading your authorized cases…</p> : <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.7fr)]">
      <section className={panel}><h2 className="font-semibold">{role === "packet_staff" ? "Current approved packets" : "Your team cases"} · {cases.length}</h2>{cases.length ? <ul className="mt-4 space-y-3">{cases.map(row => <li key={row.id}><button disabled={busy} onClick={() => { setMessage(null); void load(row.id); }} aria-current={selected?.summary.id === row.id ? "true" : undefined} className={`w-full rounded-lg border p-4 text-left text-sm ${selected?.summary.id === row.id ? "border-[#79a88b] bg-[#649b72]/10" : "border-current/15"}`}><strong>{row.id}</strong><p className="mt-2">{statusLabel(row.status)}</p><p className={`mt-2 text-xs ${muted}`}>Due {formatDate(row.dueAt, true)} · {row.blockingIssueCount} blockers</p></button></li>)}</ul> : <p className={`mt-4 text-sm leading-6 ${muted}`}>{role === "packet_staff" ? "No current signed-off packets are available. A clinician must finish review first." : "No cases are assigned to your workspace."}</p>}</section>
      {selected && <section className={panel}><h2 className="text-xl font-semibold">{selected.summary.id} · {selected.summary.levelOfCare}</h2>
        {role !== "packet_staff" && <><h3 className="mt-6 font-semibold">Open issues</h3><ul className="mt-3 space-y-2 text-sm">{selected.issues.filter(issue => issue.status !== "resolved").map(issue => <li key={issue.id} className="rounded-lg border border-current/15 p-3">{issue.description}<span className={`mt-1 block text-xs ${muted}`}>Clinician resolution required</span></li>)}</ul><h3 className="mt-6 font-semibold">Source documents</h3><ul className="mt-3 divide-y divide-current/10 text-sm">{selected.documents.map(doc => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div>{doc.title}<p className={`mt-1 text-xs ${muted}`}>{doc.serviceDate ?? "No service date"} · v{doc.version} · {doc.verificationState}</p></div>{role === "coordinator" && <button className="underline" onClick={() => { void readSource(doc.id); }}>Read original source</button>}</li>)}</ul>{source !== null && <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-current/15 p-4 text-xs leading-6">{source}</pre>}</>}
        {role === "coordinator" && <div className="mt-6 border-t border-current/10 pt-5"><h3 className="font-semibold">Attach synthetic missing note</h3><p className={`mt-2 text-sm ${muted}`}>Choose the supplied November 2 fixture. Original text is preserved; attachment does not verify it or resolve an issue.</p><input key={selected.documents.length} aria-label="Attach synthetic note" type="file" accept=".md,.txt" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); }} className="mt-4 block w-full text-sm" /></div>}
        {role === "supervisor" && <div className="mt-6 border-t border-current/10 pt-5"><label className="block font-semibold">Assigned clinician<select aria-label="Assigned clinician" disabled={busy} value={target} onChange={event => setTarget(event.target.value)} className={`mt-3 block w-full rounded-lg border border-current/20 p-3 text-sm ${night ? "bg-[#13211d]" : "bg-white"}`}>{selected.team.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><p className={`mt-3 text-sm ${muted}`}>Reassignment removes the previous clinician’s access and invalidates an existing sign-off. Active runs must finish first.</p><button onClick={() => { void assign(); }} disabled={busy || !target || target === selected.detail?.case.assignedTo} className={`${buttonClass} mt-4 disabled:opacity-50`}>{busy ? "Saving…" : "Save assignment"}</button></div>}
        {selected.packet && <><p className="mt-5 text-sm">Signed-off packet v{selected.packet.version} · {formatDate(selected.packet.approval.createdAt, true)}</p><p className={`mt-2 text-xs ${muted}`}>Packet fingerprint</p><code className="mt-2 block break-all text-xs">{selected.packet.contentHash}</code><p className={`mt-3 text-xs ${muted}`}>Approval {selected.packet.approval.id}</p><ul className="mt-6 space-y-4">{selected.packet.claims.map(claim => <li key={claim.id} className="rounded-lg border border-current/15 p-4"><h3 className="text-sm font-semibold">{claim.sectionHeading}</h3><p className="mt-3 text-sm leading-7">{claim.text}</p></li>)}</ul><p className={`mt-5 text-sm ${muted}`}>Read only · No payer submission or receipt simulation.</p></>}
      </section>}
    </div>}
  </WorkspaceShell>;
}
