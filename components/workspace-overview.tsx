"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, readApi } from "@/lib/client/api";
import type { CaseDetail, CaseSummary, DocumentSummary, Issue } from "@/lib/client/types";
import { formatDate, statusLabel } from "./case-workspace";
import { WorkspaceShell, useWorkspaceTheme, panelClass, mutedClass, buttonClass } from "./workspace-shell";

export type WorkspaceView = "queue" | "my-reviews" | "requests" | "activity" | "profile" | "notifications" | "search";
type CaseContext = { summary: CaseSummary; detail: CaseDetail; documents: DocumentSummary[]; issues: Issue[] };
const titles: Record<WorkspaceView, string> = { queue: "Work queue", "my-reviews": "My reviews", requests: "Requests", activity: "Activity", profile: "Clinician profile", notifications: "Notifications", search: "Search cases" };
const descriptions: Record<WorkspaceView, string> = { queue: "Cases needing clinical review, ordered by due time.", "my-reviews": "Your assigned concurrent reviews and their next steps.", requests: "Records and date clarifications needed to complete your reviews.", activity: "Source and packet updates across your assigned cases.", profile: "Your review context, preferences and recent work.", notifications: "Choose how review updates appear in this browser.", search: "Find an assigned case by its ID or service." };
const alertOptions = [{ key: "dueSoon", title: "Due soon", description: "Cases approaching their review deadline" }, { key: "newEvidence", title: "New evidence linked", description: "A source is attached to an assigned case" }, { key: "blockedReview", title: "Blocked review", description: "Missing documents or unresolved validation issues" }, { key: "quietHours", title: "Quiet hours", description: "10 PM–7 AM Eastern · Urgent alerts stay visible in-app" }] as const;
type Preferences = Record<typeof alertOptions[number]["key"], boolean>;
const defaults: Preferences = { dueSoon: true, newEvidence: true, blockedReview: true, quietHours: true };

export function WorkspaceOverview({ view }: { view: WorkspaceView }) {
  const router = useRouter();
  const { night } = useWorkspaceTheme();
  const [cases, setCases] = useState<CaseContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [saved, setSaved] = useState(false);
  const muted = mutedClass(night), panel = panelClass(night);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const rows = await readApi<CaseSummary[]>("/api/cases");
        const contexts = await Promise.all(rows.map(async summary => {
          const base = `/api/cases/${encodeURIComponent(summary.id)}`;
          const [detail, documents, issues] = await Promise.all([readApi<CaseDetail>(base), readApi<DocumentSummary[]>(`${base}/documents`), readApi<Issue[]>(`${base}/issues`)]);
          return { summary, detail, documents, issues };
        }));
        if (active) setCases(contexts);
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) router.replace("/login");
        else if (active) setError("Your workspace could not load. Refresh to try again.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("wellline-notifications") ?? "null");
      if (stored && typeof stored === "object") {
        const record = stored as Record<string, unknown>;
        setPreferences(Object.fromEntries(alertOptions.map(({ key }) => [key, typeof record[key] === "boolean" ? record[key] : defaults[key]])) as Preferences);
      }
    } catch { /* Use defaults for invalid browser preferences. */ }
    return () => { active = false; };
  }, [router]);

  const waiting = cases.filter(item => item.issues.some(issue => issue.type === "missing_document" && issue.status === "open"));
  const visible = (filter === "waiting" ? waiting : cases).filter(item => `${item.summary.id} ${item.summary.patientLabel} ${item.summary.levelOfCare}`.toLowerCase().includes(query.toLowerCase()));
  const openIssues = cases.flatMap(item => item.issues.filter(issue => issue.status === "open").map(issue => ({ ...issue, caseId: item.summary.id })));
  const events = cases.flatMap(item => [
    ...item.documents.map(document => ({ id: document.id, title: "Source received", detail: `${item.summary.id} · ${document.title} · v${document.version}`, time: document.receivedAt, href: `/cases/${item.summary.id}/evidence?document=${document.id}` })),
    ...(item.detail.latestPacketVersion ? [{ id: item.detail.latestPacketVersion.id, title: "Packet version created", detail: `${item.summary.id} · Version ${item.detail.latestPacketVersion.version}`, time: item.detail.latestPacketVersion.createdAt, href: `/cases/${item.summary.id}/summary` }] : []),
  ]).sort((a, b) => b.time.localeCompare(a.time));
  const demoClock = cases[0]?.detail.demoClock;
  const activity = <div>{events.slice(0, view === "activity" ? 30 : 3).map(event => <Link key={event.id} href={event.href} className="flex items-start gap-3 border-b border-current/10 py-4 last:border-0"><span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-[#79a88b]" /><span><strong className="block text-sm">{event.title}</strong><span className={`mt-1 block text-xs leading-5 ${muted}`}>{event.detail}</span><time dateTime={event.time} className={`mt-1 block text-xs ${muted}`}>{formatDate(event.time, true)}</time></span></Link>)}{!events.length && <p className={`py-5 text-sm ${muted}`}>No updates are available.</p>}</div>;

  return <WorkspaceShell title={`${view === "profile" || view === "notifications" ? "Account" : "Utilization review"} / ${titles[view]}`} headerDetail={demoClock?.enabled ? "Demo · Nov 3, 2026" : undefined}>
    <p className={`text-[11px] font-bold tracking-[0.14em] ${muted}`}>{view === "profile" || view === "notifications" ? "CLINICIAN ACCOUNT · SYNTHETIC" : "CONCURRENT REVIEW"}</p>
    <h1 className="mt-3 font-serif text-4xl">{titles[view]}</h1><p className={`mt-2 text-sm ${muted}`}>{descriptions[view]}</p>
    {demoClock?.enabled && <p className={`mt-3 text-xs ${muted}`}>Fixed demo clock: {formatDate(demoClock.now, true)}</p>}
    {loading && <p role="status" className={`mt-8 ${muted}`}>Loading workspace…</p>}
    {error && <p role="alert" className="mt-8 text-[#b45f4b]">{error}</p>}
    {!loading && !error && <>
      {(view === "queue" || view === "my-reviews" || view === "search") && <>
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-current/10 pb-4"><div aria-label="Case filters" className="flex flex-wrap gap-2">{[{ key: "all", label: `All cases ${cases.length}` }, { key: "assigned", label: `Assigned to me ${cases.length}` }, { key: "waiting", label: `Waiting on records ${waiting.length}` }].map(item => <button type="button" key={item.key} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className={`rounded-lg px-3 py-2 text-xs ${filter === item.key ? "bg-[#649b72]/15 font-semibold" : muted}`}>{item.label}</button>)}</div><label className="sr-only" htmlFor="case-search">Search cases</label><input id="case-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search cases" className={`rounded-lg border px-3 py-2 text-sm ${night ? "border-[#3c5746] bg-[#1b2e26]" : "border-[#dce5de] bg-white"}`} /></div>
            <div className={`mt-5 flex justify-between px-5 text-[10px] font-semibold tracking-wider ${muted}`}><span>CASE AND SERVICE</span><span>DUE · EASTERN</span></div>
            <div className="mt-3 space-y-3">{visible.map(({ summary: item, detail }) => <Link key={item.id} href={`/cases/${item.id}/summary`} className={`grid gap-3 rounded-xl border p-5 transition-colors hover:border-[#79a88b] sm:grid-cols-[minmax(0,1fr)_150px_135px] sm:items-center ${night ? "border-[#304b3b] bg-[#1b2e26]" : "border-[#dce5de] bg-white"}`}><span><strong className="text-sm">{item.id}</strong><span className={`ml-3 text-xs ${muted}`}>{item.levelOfCare}</span><span className={`mt-2 block text-xs ${muted}`}>{item.patientLabel} · Concurrent review</span>{detail.reviewPeriod && <span className={`mt-1 block text-xs ${muted}`}>Requested {formatDate(detail.reviewPeriod.requestedStart)} – {formatDate(detail.reviewPeriod.requestedEnd)}</span>}</span><span className="text-xs"><span className={item.blockingIssueCount ? "text-[#ad7b36]" : "text-[#659b74]"}>● {statusLabel(item.status)}</span><span className={`mt-2 block ${muted}`}>{item.blockingIssueCount} blocking issues</span></span><span className="text-xs leading-6">{formatDate(item.dueAt, true)} <span aria-hidden>→</span></span></Link>)}{!visible.length && <p className={`p-8 text-sm ${muted}`}>No assigned cases match this search or filter.</p>}</div>
          </section>
          <aside><h2 className="mb-3 text-sm font-semibold">Today at a glance</h2><section className={panel}><p className="font-serif text-4xl">{cases.filter(item => item.summary.status === "needs_review").length}</p><p className={`mt-1 text-xs ${muted}`}>cases need review</p><div className="mt-5 border-t border-current/10">{activity}</div><Link href="/activity" className="mt-4 inline-block text-xs font-semibold underline underline-offset-4">View activity →</Link></section><p className={`mt-4 text-xs leading-5 ${muted}`}>Draft assistance has source links. Every packet requires clinician review and sign-off.</p></aside>
        </div>
        {cases[0] && <section className={`mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5 ${night ? "border-[#345644] bg-[#213a2d]" : "border-[#d4e4d8] bg-[#e6f0e7]"}`}><div><h2 className="text-sm font-semibold">YOUR NEXT REVIEW · {cases[0].summary.id}</h2><p className={`mt-1 text-xs ${muted}`}>Inspect evidence, resolve blockers, recheck and sign off.</p></div><Link href={`/cases/${cases[0].summary.id}/summary`} className={buttonClass}>Explore the case →</Link></section>}
      </>}
      {view === "requests" && <div className="mt-8 space-y-4">{openIssues.map(issue => <section key={issue.id} className={panel}><span className="text-xs font-bold text-[#ad7b36]">{issue.blocking ? "BLOCKS SIGN-OFF" : "REVIEW NEEDED"}</span><h2 className="mt-3 font-semibold">{issue.caseId} · {issue.type === "missing_document" ? "Missing source document" : "Verify review dates"}</h2><p className={`mt-2 text-sm ${muted}`}>{issue.description}</p><p className={`mt-2 text-xs ${muted}`}>Assigned clinician · {issue.severity}</p><Link href={`/cases/${issue.caseId}/issues#${issue.id}`} className={`${buttonClass} mt-5`}>Open issue →</Link></section>)}{!openIssues.length && <section className={panel}>No outstanding records or date clarifications.</section>}</div>}
      {view === "activity" && <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><section className={panel}><h2 className="font-semibold">Case activity</h2>{activity}</section><aside className={panel}><h2 className="font-semibold">Source and version context</h2><p className={`mt-3 text-sm leading-6 ${muted}`}>Updates show source receipt times and packet creation records. Full actor-level audit history is not available in this view.</p><Link href="/my-reviews" className={`${buttonClass} mt-5`}>Open my reviews →</Link></aside></div>}
      {view === "profile" && <><section className={`${panel} mt-8 flex items-center gap-5`}><span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#649b72]/20 text-xl font-semibold">CR</span><div><h2 className="font-serif text-2xl">Demo Clinician (fictional)</h2><p className={`mt-2 text-sm ${muted}`}>Concurrent review clinician · Behavioral Health UR</p><p className={`mt-1 text-xs ${muted}`}>clinician_a · Eastern Time</p></div></section><div className="mt-5 grid gap-5 xl:grid-cols-3"><section className={panel}><h2 className="font-semibold">Work context</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className={muted}>Assigned team</dt><dd className="mt-1">Behavioral Health UR · Demo</dd></div><div><dt className={muted}>Primary queue</dt><dd className="mt-1">Inpatient behavioral health</dd></div><div><dt className={muted}>Assigned cases</dt><dd className="mt-1">{cases.length}</dd></div></dl><Link href="/my-reviews" className={`${buttonClass} mt-6`}>Open my assigned cases →</Link></section><section className={panel}><h2 className="font-semibold">Notification preferences</h2><p className={`mt-4 text-sm leading-6 ${muted}`}>Review alerts and quiet hours are stored in this browser for the demo.</p><Link href="/notifications" className="mt-5 inline-block text-sm font-semibold underline underline-offset-4">Edit preferences →</Link><h3 className="mt-7 font-semibold">Review permissions</h3><p className={`mt-3 text-sm leading-6 ${muted}`}>Review sources, edit or reject claims, resolve issues, and sign off when validation passes.</p></section><section className={panel}><h2 className="font-semibold">Recent activity</h2>{activity}<Link href="/activity" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">View activity →</Link></section></div></>}
      {view === "notifications" && <section className={`${panel} mt-8 max-w-3xl`}><h2 className="font-semibold">Review alerts</h2><p className={`mt-2 text-sm ${muted}`}>Demo preferences only. No email or notification delivery is configured.</p><div className="mt-6 divide-y divide-current/10">{alertOptions.map(item => <label key={item.key} className="flex cursor-pointer items-center justify-between gap-5 py-5"><span><strong className="block text-sm">{item.title}</strong><span className={`mt-1 block text-xs ${muted}`}>{item.description}</span></span><input type="checkbox" checked={preferences[item.key]} onChange={event => { setPreferences(current => ({ ...current, [item.key]: event.target.checked })); setSaved(false); }} className="size-5 accent-[#255e4b]" /></label>)}</div><button type="button" onClick={() => { localStorage.setItem("wellline-notifications", JSON.stringify(preferences)); setSaved(true); }} className={`${buttonClass} mt-5`}>Save preferences</button>{saved && <p role="status" className="mt-3 text-sm text-[#659b74]">Preferences saved in this browser.</p>}<Link href="/profile" className="ml-5 text-sm underline underline-offset-4">Back to profile</Link></section>}
    </>}
  </WorkspaceShell>;
}
