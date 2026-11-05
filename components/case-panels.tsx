"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readApi } from "@/lib/client/api";
import type { Claim, DocumentDetail, EvidenceSpan } from "@/lib/client/types";
import type { CaseData } from "./case-workspace";
import { formatDate, statusLabel } from "./case-workspace";

type Props = { data: CaseData; night: boolean; base: string };
const card = (night: boolean) => `rounded-2xl border p-6 ${night ? "border-[#304b3b] bg-[#1b2e26]" : "border-[#dce5de] bg-white"}`;
const muted = (night: boolean) => night ? "text-[#a9bbad]" : "text-[#687c6d]";
const primary = "inline-flex items-center justify-center rounded-lg bg-[#255e4b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1f513f]";
const secondary = (night: boolean) => `inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold ${night ? "bg-[#294b38] text-[#d6e9d9]" : "bg-[#e5f0e7] text-[#2c5e43]"}`;

function PageHeading({ eyebrow, title, description, night }: { eyebrow: string; title: string; description: string; night: boolean }) {
  return <div className="mb-8"><p className={`text-xs font-bold uppercase tracking-widest ${night ? "text-[#8dbf9b]" : "text-[#568267]"}`}>{eyebrow}</p><h1 className="mt-3 font-serif text-4xl">{title}</h1><p className={`mt-2 text-sm ${muted(night)}`}>{description}</p></div>;
}

function ClaimBadge({ claim, night }: { claim: Claim; night: boolean }) {
  const verified = claim.displayStatus === "source_verified" && claim.evidence.length > 0;
  const label = claim.displayStatus === "clinician_approved" ? "Clinician signed off" : claim.displayStatus === "clinician_edited" ? "Clinician edited" : verified ? "Source verified" : "Unsupported · review";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${verified || claim.displayStatus === "clinician_approved" ? night ? "bg-[#27533b] text-[#c2e7c9]" : "bg-[#e6f2e7] text-[#326a47]" : night ? "bg-[#58452b] text-[#f4d9a8]" : "bg-[#f8efdf] text-[#90662c]"}`}>{label}</span>;
}

export function SummaryPanel({ data, night, base }: Props) {
  const { detail, claims, issues, run } = data;
  const openIssues = issues.filter(issue => issue.status === "open" && issue.blocking);
  return <>
    <PageHeading eyebrow="Prepared packet" title="Case summary" description="Review the request, source-backed claims, and anything that blocks sign-off." night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(310px,1fr)]">
      <section className={card(night)} aria-labelledby="packet-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-4"><div><h2 id="packet-heading" className="text-lg font-semibold">Draft packet · Agent prepared</h2><p className={`mt-1 text-xs ${muted(night)}`}>{detail.latestPacketVersion ? `Version ${detail.latestPacketVersion.version}` : "No packet generated yet"}</p></div><span className={`text-xs ${muted(night)}`}>Clinician review required</span></div>
        {claims.length ? <div className="divide-y divide-current/10">{claims.filter(claim => claim.status !== "rejected").map(claim => <div key={claim.id} className="py-5"><div className="flex flex-wrap items-center gap-2"><ClaimBadge claim={claim} night={night} /><span className={`text-xs ${muted(night)}`}>{claim.sectionHeading}</span></div><p className="mt-3 leading-7">{claim.text}</p><Link href={`${base}/evidence?claim=${claim.id}`} className="mt-3 inline-block text-sm font-semibold text-[#3c8462] underline underline-offset-4">Inspect claim and source →</Link></div>)}</div> : <div className="py-10"><p className={muted(night)}>A packet has not been prepared. Run the three review agents, then inspect each claim against its original source.</p><Link href={`${base}/recheck`} className={`${primary} mt-5`}>Open review run →</Link></div>}
      </section>
      <div className="space-y-5">
        <section className={card(night)} aria-labelledby="period-heading"><h2 id="period-heading" className="text-lg font-semibold">Periods and deadline</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className={muted(night)}>Requested review period</dt><dd className="mt-1 font-semibold">{formatDate(detail.reviewPeriod?.requestedStart ?? null)} – {formatDate(detail.reviewPeriod?.requestedEnd ?? null)}</dd></div><div><dt className={muted(night)}>Existing authorization</dt><dd className="mt-1 font-semibold">{formatDate(detail.authorization?.approvedStart ?? null)} – {formatDate(detail.authorization?.approvedEnd ?? null)}</dd></div><div><dt className={muted(night)}>Due</dt><dd className="mt-1 font-semibold">{formatDate(detail.case.dueAt, true)}</dd></div></dl><p className={`mt-5 text-xs ${muted(night)}`}>These periods stay separate. A difference requires verification, not a silent date change.</p></section>
        <section className={card(night)} aria-labelledby="status-heading"><h2 id="status-heading" className="text-lg font-semibold">Review status</h2><p className={`mt-4 text-sm ${muted(night)}`}>Agent run: {run ? statusLabel(run.status) : "Not started"}</p><p className={`mt-2 text-sm ${muted(night)}`}>{openIssues.length} blocking issues</p><ul className="mt-4 space-y-2 text-sm">{openIssues.map(issue => <li key={issue.id} className="rounded-lg bg-[#b98c42]/10 px-3 py-2">{issue.description}</li>)}</ul><Link href={`${base}/issues`} className={`${secondary(night)} mt-5`}>Review issues →</Link></section>
      </div>
    </div>
  </>;
}

export function EvidencePanel({ data, night, base }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [sourceError, setSourceError] = useState(false);
  useEffect(() => { setSelectedId(new URLSearchParams(window.location.search).get("claim")); }, []);
  const selected = data.claims.find(claim => claim.id === selectedId) ?? data.claims[0] ?? null;
  const span: EvidenceSpan | null = selected?.evidence[0] ?? null;
  const activeDocumentId = documentId ?? span?.documentId ?? data.documents[0]?.id ?? null;
  useEffect(() => {
    if (!activeDocumentId) return;
    let active = true;
    readApi<DocumentDetail>(`/api/documents/${activeDocumentId}`).then(value => { if (active) { setDocument(value); setSourceError(false); } }).catch(() => { if (active) { setDocument(null); setSourceError(true); } });
    return () => { active = false; };
  }, [activeDocumentId]);
  const selectionSpan = document?.id === span?.documentId ? span : null;
  const validSpan = selectionSpan && document && document.content.slice(selectionSpan.startOffset, selectionSpan.endOffset) === selectionSpan.excerpt;
  return <>
    <PageHeading eyebrow="Evidence provenance" title="Evidence review" description="Select a claim to compare its wording with the original source passage." night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.15fr)]">
      <section className={card(night)} aria-labelledby="claim-list"><h2 id="claim-list" className="text-lg font-semibold">Claim to source map</h2>
        {data.claims.length ? <div className="mt-5 space-y-3">{data.claims.map(claim => <button key={claim.id} type="button" onClick={() => { setSelectedId(claim.id); setDocumentId(null); }} aria-pressed={selected?.id === claim.id} className={`w-full rounded-xl border p-4 text-left transition-colors ${selected?.id === claim.id ? night ? "border-[#7aa98a] bg-[#284337]" : "border-[#6d9d7b] bg-[#f0f7f0]" : night ? "border-[#365243] hover:bg-[#233a2e]" : "border-[#e1e9e2] hover:bg-[#f8faf8]"}`}><ClaimBadge claim={claim} night={night} /><p className="mt-3 text-sm leading-6">{claim.text}</p><p className={`mt-2 text-xs ${muted(night)}`}>{claim.evidence.length ? `${claim.evidence.length} source passage${claim.evidence.length === 1 ? "" : "s"}` : "No verified source passage"}</p></button>)}</div> : <p className={`mt-5 text-sm ${muted(night)}`}>No packet claims are available yet. Start a review run from Recheck.</p>}
        <Link href={`${base}/issues`} className={`${secondary(night)} mt-5`}>Review blockers →</Link>
      </section>
      <section className={card(night)} aria-labelledby="source-viewer"><h2 id="source-viewer" className="text-lg font-semibold">Original source</h2>
        <div className="mt-4 flex flex-wrap gap-2">{data.documents.map(item => <button key={item.id} type="button" onClick={() => setDocumentId(item.id)} className={`rounded-full border px-3 py-1.5 text-xs ${activeDocumentId === item.id ? "border-[#6a9b76] bg-[#3d7855]/15 font-semibold" : night ? "border-[#3c5746]" : "border-[#d7e1d7]"}`}>{item.title}</button>)}</div>
        {sourceError && <p role="alert" className="mt-6 text-sm text-[#b45f4b]">The source could not load.</p>}
        {document && <><dl className={`mt-5 grid gap-2 border-b border-current/10 pb-4 text-xs sm:grid-cols-2 ${muted(night)}`}><div><dt>Document</dt><dd className="mt-1 font-semibold">{document.title}</dd></div><div><dt>Service date · version</dt><dd className="mt-1 font-semibold">{formatDate(document.serviceDate)} · v{document.version}</dd></div><div><dt>Author</dt><dd className="mt-1 font-semibold">{document.author ?? "Not recorded"}</dd></div><div><dt>Verification</dt><dd className="mt-1 font-semibold">{document.verificationState}</dd></div></dl>
          <div className={`mt-5 max-h-[510px] overflow-auto whitespace-pre-wrap rounded-xl p-5 text-sm leading-7 ${night ? "bg-[#13241d]" : "bg-[#f6f8f5]"}`}>{validSpan ? <>{document.content.slice(0, selectionSpan.startOffset)}<mark className="rounded bg-[#f4df9a] px-0.5 text-[#342f1d]">{selectionSpan.excerpt}</mark>{document.content.slice(selectionSpan.endOffset)}</> : document.content}</div>
          {selectionSpan && <p className={`mt-3 text-xs ${validSpan ? "text-[#4c9563]" : "text-[#b45f4b]"}`}>{validSpan ? "Exact passage verified against this source version." : "The citation no longer matches this source. Flag it for review."}</p>}</>}
        {!document && !sourceError && <p className={`mt-6 text-sm ${muted(night)}`}>Select a claim or document to read its source.</p>}
      </section>
    </div>
  </>;
}

export function IssuesPanel({ data, night, base }: Props) {
  const { issues, detail } = data;
  return <>
    <PageHeading eyebrow="Resolution evidence" title="Resolve blocking issues" description="A source document or date verification is required before an issue can close." night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(290px,0.8fr)]">
      <div className="space-y-5">{issues.map(issue => <section key={issue.id} className={card(night)}><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold">{issue.type === "missing_document" ? `Missing ${formatDate(issue.requiredServiceDate)} progress note` : "Requested versus authorized dates"}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${issue.status === "resolved" ? "bg-[#3f8b55]/15 text-[#5fa46b]" : "bg-[#ba8735]/15 text-[#a67630]"}`}>{issue.status === "resolved" ? "Resolved" : "Blocks sign-off"}</span></div><p className={`mt-3 text-sm ${muted(night)}`}>{issue.description}</p>{issue.type === "date_conflict" && <div className={`mt-5 grid gap-3 rounded-xl p-4 text-sm sm:grid-cols-2 ${night ? "bg-[#13251d]" : "bg-[#f4f7f3]"}`}><div><span className={muted(night)}>Authorized</span><p className="mt-1 font-semibold">{formatDate(detail.authorization?.approvedStart ?? null)} – {formatDate(detail.authorization?.approvedEnd ?? null)}</p></div><div><span className={muted(night)}>Requested</span><p className="mt-1 font-semibold">{formatDate(detail.reviewPeriod?.requestedStart ?? null)} – {formatDate(detail.reviewPeriod?.requestedEnd ?? null)}</p></div></div>}{issue.status === "resolved" && <p className={`mt-4 text-sm ${muted(night)}`}>Resolution: {issue.resolutionReason}</p>}</section>)}</div>
      <aside className={card(night)}><h2 className="text-lg font-semibold">Resolution requirements</h2><ul className={`mt-5 list-disc space-y-3 pl-5 text-sm leading-6 ${muted(night)}`}><li>The missing note must be attached as an original source and verified.</li><li>Both date ranges remain visible; the clinician records the reason for the difference.</li><li>After changes, the packet is rebuilt and checked again.</li><li>A checkbox alone cannot close either issue.</li></ul><Link href={`${base}/recheck`} className={`${secondary(night)} mt-6`}>View recheck →</Link></aside>
    </div>
  </>;
}

export function RecheckPanel({ data, night, base }: Props) {
  const { run, validation } = data;
  const names: Record<string, string> = { clinical_documentation: "Clinical Documentation", case_assembly_drafting: "Case Assembly and Drafting", independent_quality: "Independent Quality" };
  return <>
    <PageHeading eyebrow="Three-agent review" title="Packet recheck" description="See each agent result and the code checks tied to the current packet." night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(290px,0.85fr)]">
      <section className={card(night)}><h2 className="text-lg font-semibold">{run ? `Latest run · ${statusLabel(run.status)}` : "No review run yet"}</h2><p className={`mt-2 text-sm ${muted(night)}`}>{run?.startedAt ? `Started ${formatDate(run.startedAt, true)}` : "A run will prepare the first versioned packet."}</p><div className="mt-6 space-y-3">{run?.agents.map(agent => <div key={agent.agent} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${night ? "border-[#355340]" : "border-[#e1e9e1]"}`}><span className="font-semibold">{names[agent.agent] ?? agent.agent}</span><span className={agent.status === "succeeded" ? "text-[#5b9c65]" : agent.status === "failed" || agent.status === "timed_out" ? "text-[#bd6b54]" : muted(night)}>{statusLabel(agent.status)}</span>{agent.message && <p className={`w-full text-xs ${muted(night)}`}>{agent.message}</p>}</div>)}{!run && <p className={muted(night)}>The app preserves each result and shows failed or timed-out agents by name.</p>}</div><Link href={`${base}/approval`} className={`${primary} mt-6`}>Review sign-off gate →</Link></section>
      <section className={card(night)}><h2 className="text-lg font-semibold">Deterministic validation</h2><ul className="mt-5 space-y-3 text-sm">{validation.report.checks.map((check, index) => <li key={`${check.name}-${index}`} className="flex items-start justify-between gap-3"><span>{check.name.replaceAll("_", " ")}</span><span className={check.result === "pass" ? "text-[#5b9c65]" : check.result === "fail" ? "text-[#bd6b54]" : muted(night)}>{statusLabel(check.result)}</span></li>)}</ul><p className={`mt-5 text-sm ${muted(night)}`}>{validation.blockers.length} current blocker{validation.blockers.length === 1 ? "" : "s"}. An incomplete run always blocks sign-off.</p></section>
    </div>
  </>;
}

export function ApprovalPanel({ data, night, base }: Props) {
  const { detail, claims, validation } = data;
  const ready = validation.packetVersionId !== null && validation.contentHash !== null && validation.blockers.length === 0;
  return <>
    <PageHeading eyebrow="Human approval gate" title={detail.case.status === "approved_for_submission" ? "Packet signed off" : ready ? "Ready for sign-off" : "Sign-off blocked"} description="Review the exact packet version and its validation result before confirming." night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.85fr)]">
      <section className={card(night)}><div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 pb-4"><h2 className="text-lg font-semibold">Packet {detail.latestPacketVersion ? `v${detail.latestPacketVersion.version}` : "pending"} · Read-only preview</h2><span className={`text-xs ${muted(night)}`}>Exact version only</span></div><div className="mt-5 space-y-3 text-sm"><p>Requested: {formatDate(detail.reviewPeriod?.requestedStart ?? null)} – {formatDate(detail.reviewPeriod?.requestedEnd ?? null)}</p><p>Authorized: {formatDate(detail.authorization?.approvedStart ?? null)} – {formatDate(detail.authorization?.approvedEnd ?? null)}</p></div><div className="mt-5 space-y-3">{claims.filter(claim => claim.status !== "rejected").map(claim => <p key={claim.id} className={`rounded-lg p-3 text-sm leading-6 ${night ? "bg-[#13251d]" : "bg-[#f5f8f4]"}`}>{claim.text}</p>)}</div><p className={`mt-5 break-all text-xs ${muted(night)}`}>Packet hash: {validation.contentHash ?? "Not available"}</p><Link href={`${base}/evidence`} className={`${secondary(night)} mt-5`}>Review evidence →</Link></section>
      <section className={card(night)}><h2 className="text-lg font-semibold">Validation result</h2><p className={`mt-3 text-sm font-semibold ${ready ? "text-[#5a9c66]" : "text-[#aa7435]"}`}>{ready ? "All checks clear" : `${validation.blockers.length} blocker${validation.blockers.length === 1 ? "" : "s"} remain`}</p><ul className="mt-5 space-y-3 text-sm">{validation.blockers.map((blocker, index) => <li key={`${blocker.code}-${blocker.objectId ?? index}`} className={`rounded-lg p-3 ${night ? "bg-[#4a3928]" : "bg-[#fbf2e5]"}`}>{blocker.message}{blocker.objectId ? <span className={`mt-1 block text-xs ${muted(night)}`}>{blocker.objectId}</span> : null}</li>)}</ul>{!ready && <Link href={`${base}/issues`} className={`${secondary(night)} mt-6`}>Resolve blockers →</Link>}{ready && <p className={`mt-6 text-sm ${muted(night)}`}>The clinician can sign off this exact version after acknowledging the review.</p>}</section>
    </div>
  </>;
}
