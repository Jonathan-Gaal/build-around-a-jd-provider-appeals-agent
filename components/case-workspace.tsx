"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ApiError, readApi } from "@/lib/client/api";
import type { CaseDetail, Claim, DocumentSummary, Issue, RunDetail, Validation } from "@/lib/client/types";
import { ApprovalPanel, EvidencePanel, IssuesPanel, RecheckPanel, SummaryPanel } from "./case-panels";

export type CaseTab = "summary" | "evidence" | "issues" | "recheck" | "approval";
export type CaseData = {
  detail: CaseDetail; documents: DocumentSummary[]; claims: Claim[];
  issues: Issue[]; validation: Validation; run: RunDetail | null;
};

const tabs: { key: CaseTab; label: string }[] = [
  { key: "summary", label: "Summary" }, { key: "evidence", label: "Evidence" },
  { key: "issues", label: "Issues" }, { key: "recheck", label: "Recheck" },
  { key: "approval", label: "Sign-off" },
];

export function statusLabel(value: string): string {
  return ({
    needs_review: "Needs review", processing: "Processing", ready_for_approval: "Ready for sign-off",
    approved_for_submission: "Signed off", partial: "Incomplete", failed: "Incomplete",
    budget_exceeded: "Incomplete", running: "Running", complete: "Complete",
  } as Record<string, string>)[value] ?? value.replaceAll("_", " ");
}

export function formatDate(value: string | null, withTime = false): string {
  if (!value) return "Not set";
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : {}),
    timeZone: "America/New_York",
  }).format(date);
}

export function CaseWorkspace({ caseId, tab }: { caseId: string; tab: CaseTab }) {
  const router = useRouter();
  const [data, setData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [night, setNight] = useState(false);

  useEffect(() => { setNight(window.localStorage.getItem("wellline-theme") === "night"); }, []);
  const changeTheme = () => setNight(current => {
    window.localStorage.setItem("wellline-theme", current ? "day" : "night");
    return !current;
  });

  const reload = useCallback(async () => {
    const base = `/api/cases/${encodeURIComponent(caseId)}`;
    try {
      const [detail, documents, claims, issues, validation] = await Promise.all([
        readApi<CaseDetail>(base), readApi<DocumentSummary[]>(`${base}/documents`),
        readApi<Claim[]>(`${base}/claims`), readApi<Issue[]>(`${base}/issues`),
        readApi<Validation>(`${base}/validation`),
      ]);
      const run = detail.latestRunGroupId ? await readApi<RunDetail>(`/api/runs/${detail.latestRunGroupId}`) : null;
      setData({ detail, documents, claims, issues, validation, run });
      setError(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) router.replace("/login");
      else if (cause instanceof ApiError && cause.status === 404) setError("This case is unavailable to your account.");
      else setError("The case could not load. Please try again.");
    } finally { setLoading(false); }
  }, [caseId, router]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (data?.run?.status !== "running") return;
    const timer = window.setInterval(() => { void reload(); }, 3000);
    return () => window.clearInterval(timer);
  }, [data?.run?.status, reload]);

  const base = `/cases/${encodeURIComponent(caseId)}`;
  const activeIssues = data?.issues.filter(issue => issue.blocking && issue.status === "open").length ?? 0;
  const status = data?.detail.case.status ?? "needs_review";
  const dark = night ? "bg-[#13211d] text-[#e6efe9]" : "bg-[#f7f8f7] text-[#1d392f]";
  const surface = night ? "border-[#294137] bg-[#1b2d26]" : "border-[#dce5de] bg-white";
  const muted = night ? "text-[#a2b7a9]" : "text-[#63786c]";

  return (
    <div className={`min-h-screen ${dark}`}>
      <div className="grid min-h-screen lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className={`border-b p-5 lg:border-b-0 lg:border-r ${night ? "border-[#294137] bg-[#182b23]" : "border-[#dce5de] bg-[#eef2ee]"}`}>
          <Link href="/" className="flex items-center gap-3" aria-label="Wellline Review, back to work queue">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#255e4b] font-serif text-xl font-bold text-white">W</span>
            <span><strong className="block text-sm">Wellline Review</strong><small className={`block text-[10px] tracking-wider ${muted}`}>CLINICIAN WORKSPACE</small></span>
          </Link>
          <p className={`mt-10 hidden text-xs font-semibold tracking-widest lg:block ${muted}`}>CASE REVIEW</p>
          <nav aria-label="Case review" className="mt-3 flex flex-wrap gap-1 lg:block">
            {tabs.map(item => <Link key={item.key} href={`${base}/${item.key}`} aria-current={tab === item.key ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-sm transition-colors ${tab === item.key ? night ? "bg-[#2b5140] font-semibold text-white" : "bg-[#dfeae2] font-semibold text-[#214a39]" : night ? "text-[#b2c4b7] hover:bg-[#24392e]" : "text-[#476354] hover:bg-[#e4eee6]"}`}>{item.label}{item.key === "issues" && activeIssues > 0 ? ` (${activeIssues})` : ""}</Link>)}
          </nav>
          <div className={`mt-10 hidden rounded-xl border p-3 text-xs lg:block ${night ? "border-[#345644] bg-[#213a2d] text-[#b8cebb]" : "border-[#d4e4d8] bg-[#e6f0e7] text-[#476555]"}`}>
            <strong className="block">SYNTHETIC DATA</strong>No payer submission
          </div>
        </aside>
        <main className="min-w-0">
          <header className={`flex min-h-16 flex-wrap items-center justify-between gap-3 border-b px-6 py-3 lg:px-10 ${surface}`}>
            <div className="text-sm"><strong>{caseId}</strong><span className={`ml-2 ${muted}`}>· Concurrent review · {data?.detail.latestPacketVersion ? `Packet v${data.detail.latestPacketVersion.version}` : "Packet pending"}</span></div>
            <div className="flex items-center gap-3 text-xs">
              <span className={muted}>Due {formatDate(data?.detail.case.dueAt ?? null, true)}</span>
              <button type="button" onClick={changeTheme} aria-label={night ? "Switch to day mode" : "Switch to night mode"} className={`rounded-full px-3 py-2 font-semibold ${night ? "bg-[#2d4a3a] text-[#d6e9d8]" : "bg-[#e9f2e9] text-[#3c674d]"}`}>{night ? "☀ Day mode" : "☾ Night mode"}</button>
              <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className={`flex size-9 items-center justify-center rounded-full font-bold ${night ? "bg-[#345544]" : "bg-[#e7efe8]"}`} aria-label="Sign out of demo clinician account">CR</button>
            </div>
          </header>
          <div className="mx-auto max-w-[1320px] px-6 py-9 lg:px-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <span className={`text-xs font-bold tracking-[0.14em] ${night ? "text-[#99c7a6]" : "text-[#507763]"}`}>CLINICIAN MVP · SYNTHETIC CASE</span>
              {data && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeIssues || data.validation.blockers.length ? night ? "bg-[#5a4328] text-[#ffe2b3]" : "bg-[#fbf1e2] text-[#94682d]" : night ? "bg-[#264e39] text-[#b9e5c3]" : "bg-[#e6f2e7] text-[#356546]"}`}>{activeIssues ? `${activeIssues} BLOCKING ISSUES` : statusLabel(status)}</span>}
            </div>
            {loading && <p role="status" className={muted}>Loading case…</p>}
            {error && <div role="alert" className={`rounded-xl border p-6 ${surface}`}>{error} <button className="ml-2 underline" onClick={() => { setLoading(true); void reload(); }}>Retry</button></div>}
            {data && !error && (
              <>
                {tab === "summary" && <SummaryPanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                {tab === "evidence" && <EvidencePanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                {tab === "issues" && <IssuesPanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                {tab === "recheck" && <RecheckPanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                {tab === "approval" && <ApprovalPanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                <p className={`mt-8 text-xs ${muted}`}>This workspace prepares and checks a synthetic packet. A clinician reviews every claim and signs off the exact version. Nothing is sent to a payer.</p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
