"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceShell, useWorkspaceTheme } from "./workspace-shell";
import { ApiError } from "@/lib/client/api";
import { readCaseSnapshot, type CaseSnapshot } from "@/lib/client/case-snapshot";
import { ApprovalPanel, EvidencePanel, IssuesPanel, RecheckPanel, SummaryPanel, AttachmentPanel, DatesPanel } from "./case-panels";

export type CaseTab = "summary" | "evidence" | "issues" | "recheck" | "approval" | "attachment" | "dates";
export type CaseData = CaseSnapshot;

const tabs: { key: CaseTab; label: string }[] = [
  { key: "summary", label: "Summary" }, { key: "evidence", label: "Evidence" },
  { key: "issues", label: "Issues" }, { key: "recheck", label: "Recheck" },
  { key: "approval", label: "Sign-off" },
];

export function statusLabel(value: string): string {
  return ({
    needs_review: "Needs review", processing: "Processing", ready_for_approval: "Ready for sign-off",
    approved_for_submission: "Signed off", partial: "Incomplete", failed: "Incomplete",
    succeeded: "Complete", queued: "Queued", timed_out: "Timed out", skipped: "Skipped", replayed: "Replayed", budget_exceeded: "Incomplete", running: "Running", complete: "Complete",
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
  const requestSequence = useRef({ value: 0 });

  const reload = useCallback(async () => {
    const request = ++requestSequence.current.value;
    try {
      const snapshot = await readCaseSnapshot(caseId);
      if (request !== requestSequence.current.value) return;
      setData(snapshot);
      setError(null);
    } catch (cause) {
      if (request !== requestSequence.current.value) return;
      if (cause instanceof ApiError && cause.status === 401) router.replace("/login");
      else if (cause instanceof ApiError && cause.status === 404) setError("This case is unavailable to your account.");
      else setError("The case could not load. Please try again.");
    } finally { if (request === requestSequence.current.value) setLoading(false); }
  }, [caseId, router]);

  useEffect(() => { const sequence = requestSequence.current; void reload(); return () => { sequence.value++; }; }, [reload]);
  useEffect(() => { const refresh = () => { void reload(); }; window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [reload]);
  useEffect(() => {
    if (data?.run?.status !== "running") return;
    let cancelled = false;
    let timer: number;
    const poll = async () => { await reload(); if (!cancelled) timer = window.setTimeout(() => { void poll(); }, 2000); };
    timer = window.setTimeout(() => { void poll(); }, 2000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [data?.run?.status, reload]);

  const base = `/cases/${encodeURIComponent(caseId)}`;
  const activeIssues = data?.issues.filter(issue => issue.blocking && issue.status !== "resolved").length ?? 0;
  const status = data?.detail.case.status ?? "needs_review";
  const muted = night ? "text-[#a2b7a9]" : "text-[#63786c]";
  const surface = night ? "border-[#294137] bg-[#1b2d26]" : "border-[#dce5de] bg-white";
  return <WorkspaceShell title={caseId + " · Concurrent review · " + (data?.detail.latestPacketVersion ? "Packet v" + data.detail.latestPacketVersion.version : "Packet pending")}
    headerDetail={"Due " + formatDate(data?.detail.case.dueAt ?? null, true)}
    caseNavigation={<nav aria-label="Case review" className="mt-3 flex flex-wrap gap-1 lg:block">{tabs.map(item => <Link key={item.key} href={base + "/" + item.key} aria-current={tab === item.key ? "page" : undefined} className={"block rounded-lg px-3 py-2 text-sm " + (tab === item.key ? "bg-[#649b72]/20 font-semibold" : muted)}>{item.label}{item.key === "issues" && activeIssues > 0 ? " (" + activeIssues + ")" : ""}</Link>)}</nav>}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <span className={`text-xs font-bold tracking-[0.14em] ${night ? "text-[#99c7a6]" : "text-[#507763]"}`}>CLINICIAN MVP · SYNTHETIC CASE</span>
              {data && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeIssues || data.validation.blockers.length ? night ? "bg-[#5a4328] text-[#ffe2b3]" : "bg-[#fbf1e2] text-[#94682d]" : night ? "bg-[#264e39] text-[#b9e5c3]" : "bg-[#e6f2e7] text-[#356546]"}`}>{activeIssues ? `${activeIssues} BLOCKING ISSUE${activeIssues === 1 ? "" : "S"}` : statusLabel(status)}</span>}
            </div>
            {loading && <p role="status" className={muted}>Loading case…</p>}
            {error && <div role="alert" className={`rounded-xl border p-6 ${surface}`}>{error} <button className="ml-2 underline" onClick={() => { setLoading(true); void reload(); }}>Retry</button></div>}
            {data && !error && (
              <>
                {data.isolatedTest && <p role="status" className="mb-5 rounded-lg border border-[#bd9d61] bg-[#fbf2e5] p-4 text-sm text-[#70582d]">Isolated browser test · Deterministic fake model clients · Real backend and test database · Zero live model calls</p>}
                <nav aria-label="Review journey" className="mb-7 flex flex-wrap gap-2 border-b border-current/10 pb-5">{tabs.map((item, index) => <Link key={item.key} href={`${base}/${item.key}`} aria-current={tab === item.key ? "step" : undefined} className={`rounded-full px-3 py-2 text-xs ${tab === item.key ? "bg-[#649b72]/20 font-semibold" : muted}`}>{index + 1} · {item.label}</Link>)}</nav>
                {data.detail.demoClock.enabled && <p className={`mb-5 text-xs ${muted}`}>Fixed demo clock: {formatDate(data.detail.demoClock.now, true)}</p>}
                {tab === "summary" && <SummaryPanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                {tab === "evidence" && <EvidencePanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                {tab === "issues" && <IssuesPanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                {tab === "recheck" && <RecheckPanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                {tab === "approval" && <ApprovalPanel key={`${data.validation.packetVersionId}:${data.validation.contentHash}`} data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                {tab === "attachment" && <AttachmentPanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                {tab === "dates" && <DatesPanel data={data} night={night} base={base} caseId={caseId} onChange={reload} />}
                <p className={`mt-8 text-xs ${muted}`}>This workspace prepares and checks a synthetic packet. A clinician reviews every claim and signs off the exact version. Nothing is sent to a payer.</p>
              </>
            )}
  </WorkspaceShell>;
}
