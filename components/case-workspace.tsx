"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceShell, useWorkspaceTheme } from "./workspace-shell";
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
  const { night } = useWorkspaceTheme();

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
  const muted = night ? "text-[#a2b7a9]" : "text-[#63786c]";
  const surface = night ? "border-[#294137] bg-[#1b2d26]" : "border-[#dce5de] bg-white";
  return <WorkspaceShell title={caseId + " · Concurrent review · " + (data?.detail.latestPacketVersion ? "Packet v" + data.detail.latestPacketVersion.version : "Packet pending")}
    headerDetail={"Due " + formatDate(data?.detail.case.dueAt ?? null, true)}
    caseNavigation={<nav aria-label="Case review" className="mt-3 flex flex-wrap gap-1 lg:block">{tabs.map(item => <Link key={item.key} href={base + "/" + item.key} aria-current={tab === item.key ? "page" : undefined} className={"block rounded-lg px-3 py-2 text-sm " + (tab === item.key ? "bg-[#649b72]/20 font-semibold" : muted)}>{item.label}{item.key === "issues" && activeIssues > 0 ? " (" + activeIssues + ")" : ""}</Link>)}</nav>}>
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
  </WorkspaceShell>;
}
