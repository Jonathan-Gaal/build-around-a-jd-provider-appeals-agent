"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ApiError, readApi } from "@/lib/client/api";
import type { CaseSummary } from "@/lib/client/types";

function caseStatus(status: string): string {
  return ({
    needs_review: "Needs review",
    processing: "Processing",
    ready_for_approval: "Ready for sign-off",
    approved_for_submission: "Signed off",
  } as Record<string, string>)[status] ?? status.replaceAll("_", " ");
}

function dueLabel(value: string | null): string {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York", timeZoneName: "short",
  }).format(new Date(value));
}

export default function QueuePage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readApi<CaseSummary[]>("/api/cases")
      .then(setCases)
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) router.replace("/login");
        else setError("The work queue could not load. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f7f8f7] text-[#1d392f]">
      <div className="grid min-h-screen lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="border-b border-[#dce5de] bg-[#eef2ee] p-5 lg:border-b-0 lg:border-r">
          <Link href="/" className="flex items-center gap-3 text-[#1b4938]">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#255e4b] font-serif text-xl font-bold text-white">W</span>
            <span><strong className="block text-sm">Wellline Review</strong><small className="block text-[10px] tracking-wider">CLINICIAN WORKSPACE</small></span>
          </Link>
          <p className="mt-10 hidden text-xs font-semibold tracking-widest text-[#72877b] lg:block">WORKSPACE</p>
          <nav aria-label="Workspace" className="mt-3 flex flex-wrap gap-2 lg:block">
            <span className="block rounded-lg bg-[#dfeae2] px-3 py-2 text-sm font-semibold text-[#214a39]">Work queue</span>
            <span className="block px-3 py-2 text-sm text-[#74867b]">My reviews</span>
          </nav>
          <div className="mt-10 hidden rounded-xl border border-[#d4e4d8] bg-[#e6f0e7] p-3 text-xs text-[#476555] lg:block">
            <strong className="block text-[#245640]">Prototype environment</strong>
            Fictional cases · Human review
          </div>
        </aside>
        <main>
          <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[#e2e8e3] bg-white px-6 lg:px-10">
            <span className="text-sm text-[#60756a]">Utilization review / Work queue</span>
            <div className="flex items-center gap-4">
              <span className="rounded-full bg-[#edf3ee] px-3 py-1 text-xs font-semibold text-[#35624e]">SYNTHETIC DATA</span>
              <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm font-medium text-[#476354] hover:underline">Sign out</button>
            </div>
          </header>
          <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
            <p className="text-xs font-bold tracking-[0.14em] text-[#507763]">CONCURRENT REVIEW</p>
            <h1 className="mt-3 font-serif text-4xl text-[#1e3e31]">Work queue</h1>
            <p className="mt-2 text-[#63786c]">Cases needing clinical review, ordered by due time.</p>
            <div className="mt-8 overflow-hidden rounded-2xl border border-[#dce5de] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e8ede8] px-6 py-5">
                <div><h2 className="font-semibold">Assigned cases</h2><p className="mt-1 text-xs text-[#7a8a80]">All times Eastern · Synthetic data only</p></div>
                <span className="rounded-full bg-[#f0f4f0] px-3 py-1 text-sm text-[#4b6554]">{cases.length} cases</span>
              </div>
              {loading && <p role="status" className="px-6 py-10 text-sm text-[#657b6d]">Loading assigned cases…</p>}
              {error && <div role="alert" className="px-6 py-8 text-sm text-[#9a4c3f]">{error} <button className="underline" onClick={() => window.location.reload()}>Retry</button></div>}
              {!loading && !error && cases.length === 0 && <p className="px-6 py-10 text-sm text-[#657b6d]">No cases are assigned to this account.</p>}
              {!loading && !error && cases.map((item) => (
                <Link key={item.id} href={`/cases/${encodeURIComponent(item.id)}/summary`} className="grid gap-3 border-b border-[#eef1ed] px-6 py-5 transition-colors hover:bg-[#f7faf7] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#255e4b] sm:grid-cols-[minmax(0,1fr)_150px_150px_36px] sm:items-center">
                  <span><strong className="block text-base">{item.id}</strong><span className="mt-1 block text-sm text-[#576b5d]">{item.levelOfCare} · {item.patientLabel}</span></span>
                  <span><span className="block text-[10px] font-bold tracking-wider text-[#7a8b80]">DUE</span><span className="mt-1 block text-sm font-medium">{dueLabel(item.dueAt)}</span></span>
                  <span><span className="inline-block rounded-full bg-[#f7eedf] px-3 py-1 text-xs font-semibold text-[#92672d]">{caseStatus(item.status)}</span>{item.blockingIssueCount > 0 && <span className="mt-1 block text-xs text-[#9a6531]">{item.blockingIssueCount} blocking issues</span>}</span>
                  <span aria-hidden className="text-right text-xl text-[#527c64]">→</span>
                </Link>
              ))}
            </div>
            <p className="mt-5 text-xs text-[#829086]">No clinical determination or payer submission is performed by this app.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
