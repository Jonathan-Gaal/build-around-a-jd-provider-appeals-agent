"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { canSignOff } from "@/lib/client/review-state";
import { ApiError, readApi, writeApi } from "@/lib/client/api";
import type { Claim, DocumentDetail, DocumentSummary, EvidenceSpan } from "@/lib/client/types";
import type { CaseData } from "./case-workspace";
import { formatDate, statusLabel } from "./case-workspace";

type Props = { data: CaseData; night: boolean; base: string; caseId: string; onChange: () => Promise<void> };
const card = (night: boolean) => `rounded-2xl border p-6 ${night ? "border-[#304b3b] bg-[#1b2e26]" : "border-[#dce5de] bg-white"}`;
const muted = (night: boolean) => night ? "text-[#a9bbad]" : "text-[#687c6d]";
const primary = "inline-flex items-center justify-center rounded-lg bg-[#255e4b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1f513f]";
const secondary = (night: boolean) => `inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold ${night ? "bg-[#294b38] text-[#d6e9d9]" : "bg-[#e5f0e7] text-[#2c5e43]"}`;

function useAction(onChange: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function perform(action: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(true); setError(null); setMessage(null);
    try { await action(); await onChange(); setMessage(success); return true; }
    catch (cause) {
      setError(cause instanceof ApiError ? `The action was refused: ${cause.code.replaceAll("_", " ")}.` : "The action could not complete. Please try again.");
      await onChange(); return false;
    } finally { setBusy(false); }
  }
  return { busy, error, message, perform };
}

function ActionFeedback({ error, message }: { error: string | null; message: string | null }) {
  return <>{error && <p role="alert" className="mt-4 text-sm text-[#bc6552]">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-[#4d9b61]">{message}</p>}</>;
}

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
      <section className={card(night)} aria-labelledby="packet-heading">{openIssues.some(issue => issue.type === "missing_document") && <div className="mb-5 rounded-lg bg-[#ba8735]/10 p-4 text-sm"><strong className="text-[#ad7b36]">Nov 2 note missing · Unsupported source</strong><p className="mt-2">No statement is drafted from the absent note.</p><Link href={`${base}/attachment`} className="mt-3 inline-block font-semibold underline underline-offset-4">Attach original note →</Link></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-4"><div><h2 id="packet-heading" className="text-lg font-semibold">Draft packet · Agent prepared</h2><p className={`mt-1 text-xs ${muted(night)}`}>{detail.latestPacketVersion ? `Version ${detail.latestPacketVersion.version}` : "No packet generated yet"}</p></div><span className={`text-xs ${muted(night)}`}>Clinician review required</span></div>
        {claims.length ? <div className="divide-y divide-current/10">{claims.filter(claim => claim.status !== "rejected").map(claim => <div key={claim.id} className="py-5"><div className="flex flex-wrap items-center gap-2"><ClaimBadge claim={claim} night={night} /><span className={`text-xs ${muted(night)}`}>{claim.sectionHeading}</span></div><p className="mt-3 leading-7">{claim.text}</p><Link href={`${base}/evidence?claim=${claim.id}`} className="mt-3 inline-block text-sm font-semibold text-[#3c8462] underline underline-offset-4">Inspect claim and source →</Link></div>)}</div> : <div className="py-10"><p className={muted(night)}>A packet has not been prepared. Run the three review agents, then inspect each claim against its original source.</p><Link href={`${base}/recheck`} className={`${primary} mt-5`}>Open review run →</Link></div>}
      </section>
      <div className="space-y-5">
        <section className={card(night)} aria-labelledby="period-heading"><h2 id="period-heading" className="text-lg font-semibold">Periods and deadline</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className={muted(night)}>Requested review period</dt><dd className="mt-1 font-semibold">{formatDate(detail.reviewPeriod?.requestedStart ?? null)} – {formatDate(detail.reviewPeriod?.requestedEnd ?? null)}</dd></div><div><dt className={muted(night)}>Existing authorization</dt><dd className="mt-1 font-semibold">{formatDate(detail.authorization?.approvedStart ?? null)} – {formatDate(detail.authorization?.approvedEnd ?? null)}</dd></div><div><dt className={muted(night)}>Due</dt><dd className="mt-1 font-semibold">{formatDate(detail.case.dueAt, true)}</dd></div></dl><p className={`mt-5 text-xs ${muted(night)}`}>These periods stay separate. A difference requires verification, not a silent date change.</p><Link href={`${base}/dates`} className={`${secondary(night)} mt-4`}>Inspect dates and sources →</Link></section>
        <section className={card(night)} aria-labelledby="status-heading"><h2 id="status-heading" className="text-lg font-semibold">Review status</h2><div className="mt-4 space-y-3">{run?.agents.map(agent => <p key={agent.agent} className={`text-sm ${muted(night)}`}>{agent.agent.replaceAll("_", " ")} · {statusLabel(agent.status)}</p>)}</div><p className={`mt-4 text-sm ${muted(night)}`}>Agent run: {run ? statusLabel(run.status) : "Not started"}</p><p className={`mt-2 text-sm ${muted(night)}`}>{openIssues.length} blocking issues</p><ul className="mt-4 space-y-2 text-sm">{openIssues.map(issue => <li key={issue.id} className="rounded-lg bg-[#b98c42]/10 px-3 py-2">{issue.description}</li>)}</ul><Link href={`${base}/issues`} className={`${secondary(night)} mt-5`}>Review issues →</Link></section>
      </div>
    </div>
  </>;
}

export function EvidencePanel({ data, night, base, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [sourceError, setSourceError] = useState(false);
  const [draft, setDraft] = useState("");
  const [flagReason, setFlagReason] = useState("");
  const action = useAction(onChange);
  useEffect(() => { const query = new URLSearchParams(window.location.search); setSelectedId(query.get("claim")); setDocumentId(query.get("document")); }, []);
  const selected = data.claims.find(claim => claim.id === selectedId) ?? data.claims[0] ?? null;
  useEffect(() => { setDraft(selected?.text ?? ""); }, [selected?.id, selected?.text]);
  const [spanIndex, setSpanIndex] = useState(0);
  const span: EvidenceSpan | null = selected?.evidence[spanIndex] ?? selected?.evidence[0] ?? null;
  const activeDocumentId = documentId ?? span?.documentId ?? data.documents[0]?.id ?? null;
  useEffect(() => {
    if (!activeDocumentId) return;
    let active = true;
    setDocument(null); setSourceError(false);
    readApi<DocumentDetail>(`/api/documents/${activeDocumentId}`).then(value => { if (active) { setDocument(value); setSourceError(false); } }).catch(() => { if (active) { setDocument(null); setSourceError(true); } });
    return () => { active = false; };
  }, [activeDocumentId]);
  const selectionSpan = document?.id === span?.documentId ? span : null;
  const validSpan = selectionSpan && document && document.content.slice(selectionSpan.startOffset, selectionSpan.endOffset) === selectionSpan.excerpt;
  return <>
    <PageHeading eyebrow="Evidence provenance" title="Evidence review" description="Select a claim to compare its wording with the original source passage." night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.15fr)]">
      <section className={card(night)} aria-labelledby="claim-list"><h2 id="claim-list" className="text-lg font-semibold">Claim to source map</h2>{data.issues.some(issue => issue.type === "missing_document" && issue.status === "open") && <div className="mt-5 rounded-lg bg-[#ba8735]/10 p-4 text-sm"><strong className="text-[#ad7b36]">Missing source · Unsupported</strong><p className="mt-2">The November 2 note is absent. No statement can be supported by that source.</p><Link href={`${base}/attachment`} className="mt-3 inline-block underline underline-offset-4">Attach original note →</Link></div>}
        {data.claims.length ? <div className="mt-5 space-y-3">{data.claims.map(claim => <button key={claim.id} type="button" onClick={() => { setSelectedId(claim.id); setDocumentId(null); setSpanIndex(0); setFlagReason(""); }} aria-pressed={selected?.id === claim.id} className={`w-full rounded-xl border p-4 text-left transition-colors ${selected?.id === claim.id ? night ? "border-[#7aa98a] bg-[#284337]" : "border-[#6d9d7b] bg-[#f0f7f0]" : night ? "border-[#365243] hover:bg-[#233a2e]" : "border-[#e1e9e2] hover:bg-[#f8faf8]"}`}><ClaimBadge claim={claim} night={night} /><p className="mt-3 text-sm leading-6">{claim.text}</p><p className={`mt-2 text-xs ${muted(night)}`}>{claim.evidence.length ? `${claim.evidence.length} source passage${claim.evidence.length === 1 ? "" : "s"}` : "No verified source passage"}</p></button>)}</div> : <p className={`mt-5 text-sm ${muted(night)}`}>No packet claims are available yet. Start a review run from Recheck.</p>}
        <Link href={`${base}/issues`} className={`${secondary(night)} mt-5`}>Review blockers →</Link>
        {selected && <div className="mt-7 border-t border-current/10 pt-5"><h3 className="font-semibold">Clinician review of selected claim</h3><label className="mt-4 block text-sm">Edit draft wording<textarea value={draft} onChange={event => setDraft(event.target.value)} rows={3} maxLength={2000} className={`mt-2 w-full rounded-lg border p-3 outline-none focus:border-[#649b72] ${night ? "border-[#45614c] bg-[#15271e]" : "border-[#d1dfd3] bg-white"}`} /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={action.busy || !draft.trim() || draft.trim() === selected.text} onClick={() => { void action.perform(async () => { await writeApi(`/api/claims/${selected.id}`, "PATCH", { text: draft.trim() }); setSelectedId(null); }, "Claim wording saved. Review the new packet state before sign-off."); }} className={`${primary} disabled:cursor-not-allowed disabled:opacity-50`}>Save wording</button><button type="button" disabled={action.busy} onClick={() => { void action.perform(async () => { await writeApi(`/api/claims/${selected.id}`, "PATCH", { status: "rejected" }); setSelectedId(null); }, "Claim rejected and removed from the packet preview."); }} className={`${secondary(night)} disabled:opacity-50`}>Reject claim</button></div><label className="mt-5 block text-sm">Citation concern<input value={flagReason} onChange={event => setFlagReason(event.target.value)} maxLength={2000} placeholder="Why does this source need review?" className={`mt-2 w-full rounded-lg border px-3 py-2 outline-none focus:border-[#649b72] ${night ? "border-[#45614c] bg-[#15271e]" : "border-[#d1dfd3] bg-white"}`} /></label><button type="button" disabled={action.busy || !flagReason.trim()} onClick={() => { void action.perform(async () => { await writeApi(`/api/claims/${selected.id}/flags`, "POST", { reason: flagReason.trim() }); setFlagReason(""); }, "Citation flagged. Sign-off is blocked until the claim is reviewed."); }} className={`${secondary(night)} mt-3 disabled:cursor-not-allowed disabled:opacity-50`}>Flag citation</button><ActionFeedback error={action.error} message={action.message} /></div>}
      </section>
      <section className={card(night)} aria-labelledby="source-viewer"><h2 id="source-viewer" className="text-lg font-semibold">Original source</h2>{selected && selected.evidence.length > 1 && <div aria-label="Claim source passages" className="mt-4 flex flex-wrap gap-2">{selected.evidence.map((passage, index) => <button key={passage.id} type="button" aria-pressed={index === spanIndex} onClick={() => { setSpanIndex(index); setDocumentId(passage.documentId); }} className={`${secondary(night)} px-3 py-2`}>Passage {index + 1}</button>)}</div>}
        <div className="mt-4 flex flex-wrap gap-2">{data.documents.map(item => <button key={item.id} type="button" onClick={() => setDocumentId(item.id)} className={`rounded-full border px-3 py-1.5 text-xs ${activeDocumentId === item.id ? "border-[#6a9b76] bg-[#3d7855]/15 font-semibold" : night ? "border-[#3c5746]" : "border-[#d7e1d7]"}`}>{item.title}</button>)}</div>
        {sourceError && <p role="alert" className="mt-6 text-sm text-[#b45f4b]">The source could not load.</p>}
        {document && <><dl className={`mt-5 grid gap-2 border-b border-current/10 pb-4 text-xs sm:grid-cols-2 ${muted(night)}`}><div><dt>Document</dt><dd className="mt-1 font-semibold">{document.title}</dd></div><div><dt>Service date · version</dt><dd className="mt-1 font-semibold">{formatDate(document.serviceDate)} · v{document.version}</dd></div><div><dt>Author</dt><dd className="mt-1 font-semibold">{document.author ?? "Not recorded"}</dd></div><div><dt>Verification</dt><dd className="mt-1 font-semibold">{document.verificationState}</dd></div></dl>
          <div className={`mt-5 max-h-[510px] overflow-auto whitespace-pre-wrap rounded-xl p-5 text-sm leading-7 ${night ? "bg-[#13241d]" : "bg-[#f6f8f5]"}`}>{validSpan ? <>{document.content.slice(0, selectionSpan.startOffset)}<mark className="rounded bg-[#f4df9a] px-0.5 text-[#342f1d]">{selectionSpan.excerpt}</mark>{document.content.slice(selectionSpan.endOffset)}</> : document.content}</div>
          {selectionSpan && <p className={`mt-3 break-all text-xs ${muted(night)}`}>Document {document.id} · offsets {selectionSpan.startOffset}–{selectionSpan.endOffset} · {selectionSpan.method}<br />Source hash: {document.contentHash}</p>}{selectionSpan && <p className={`mt-3 text-xs ${validSpan ? "text-[#4c9563]" : "text-[#b45f4b]"}`}>{validSpan ? "Exact passage verified against this source version." : "The citation no longer matches this source. Flag it for review."}</p>}</>}
        {!document && !sourceError && <p className={`mt-6 text-sm ${muted(night)}`}>Select a claim or document to read its source.</p>}
      </section>
    </div>
  </>;
}

export function IssuesPanel(props: Props) {
  const { data, night, base } = props;
  const { issues, detail } = data;
  return <>
    <PageHeading eyebrow="Resolution evidence" title="Resolve blocking issues" description="A source document or date verification is required before an issue can close." night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(290px,0.8fr)]">
      <div className="space-y-5">{issues.map(issue => <section key={issue.id} id={issue.id} className={card(night)}>
        <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold">{issue.type === "missing_document" && issue.requiredServiceDate ? `Missing ${formatDate(issue.requiredServiceDate)} progress note` : issue.type === "date_conflict" ? "Requested versus authorized dates" : "Source review required"}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${issue.status === "resolved" ? "bg-[#3f8b55]/15 text-[#5fa46b]" : "bg-[#ba8735]/15 text-[#a67630]"}`}>{issue.status === "resolved" ? "Resolved" : "Blocks sign-off"}</span></div>
        <p className={`mt-3 text-sm ${muted(night)}`}>{issue.description}</p>
        {issue.type === "date_conflict" && <div className={`mt-5 grid gap-3 rounded-xl p-4 text-sm sm:grid-cols-2 ${night ? "bg-[#13251d]" : "bg-[#f4f7f3]"}`}><div><span className={muted(night)}>Authorized</span><p className="mt-1 font-semibold">{formatDate(detail.authorization?.approvedStart ?? null)} – {formatDate(detail.authorization?.approvedEnd ?? null)}</p></div><div><span className={muted(night)}>Requested</span><p className="mt-1 font-semibold">{formatDate(detail.reviewPeriod?.requestedStart ?? null)} – {formatDate(detail.reviewPeriod?.requestedEnd ?? null)}</p></div></div>}
        {issue.status === "resolved" ? <p className={`mt-4 text-sm ${muted(night)}`}>Resolution: {issue.resolutionReason}</p> : issue.type === "missing_document" && issue.requiredServiceDate === "2026-11-02" ? <div className="mt-5"><Link href={`${base}/attachment`} className={primary}>Attach original note →</Link></div> : issue.type === "date_conflict" ? <div className="mt-5"><Link href={`${base}/dates`} className={primary}>Verify review dates →</Link></div> : <Link href={`${base}/evidence`} className={`${secondary(night)} mt-5`}>Review supporting evidence →</Link>}
      </section>)}</div>
      <aside className={card(night)}><h2 className="text-lg font-semibold">Resolution requirements</h2><ul className={`mt-5 list-disc space-y-3 pl-5 text-sm leading-6 ${muted(night)}`}><li>The missing note must be attached as an original source and verified.</li><li>Both date ranges remain visible; the clinician records the reason for the difference.</li><li>After changes, the packet is rebuilt and checked again.</li><li>A checkbox alone cannot close either issue.</li></ul><Link href={`${base}/recheck`} className={`${secondary(night)} mt-6`}>View recheck →</Link></aside>
    </div>
  </>;
}

const NOTE_HASH = "56a21a599f1177139c4182087a60e837ddc0ad7f5118f72830c0d8e536b32ece";

function MissingNoteResolution({ data, night, caseId, onChange, issueId }: Props & { issueId: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [reason, setReason] = useState("Original synthetic November 2 progress note attached and verified.");
  const action = useAction(onChange);
  const existing = data.documents.find(item => item.type === "progress_note" && item.serviceDate === "2026-11-02" && item.verificationState !== "rejected");

  async function selectFile(file: File | undefined) {
    setContent(null); setFileError(null); setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > 30000) { setFileError("The document is too large for this demo."); return; }
    const raw = await file.text();
    const frontMatter = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    if (!frontMatter) { setFileError("Select the synthetic November 2 Markdown fixture."); return; }
    const body = raw.slice(frontMatter[0].length).trim();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)))).map(byte => byte.toString(16).padStart(2, "0")).join("");
    if (hash !== NOTE_HASH) { setFileError("This is not the allowlisted synthetic November 2 note. No content was uploaded."); return; }
    setContent(body);
  }

  async function attachAndResolve() {
    await action.perform(async () => {
      let documentId = existing?.id;
      if (!documentId) {
        if (!content) throw new Error("missing_note_content");
        const uploaded = await writeApi<{ id: string }>(`/api/cases/${encodeURIComponent(caseId)}/documents`, "POST", {
          type: "progress_note", title: "Psychiatry progress note, hospital day 2",
          author: "Dr. Lena Ortiz, MD (fictional)", serviceDate: "2026-11-02", content,
        });
        documentId = uploaded.id;
      }
      if (!existing || existing.verificationState === "unverified") await writeApi(`/api/documents/${documentId}/verify`, "POST", { decision: "verified" });
      await writeApi(`/api/issues/${issueId}/resolve`, "POST", { resolution: "attach_document", reason: reason.trim(), evidenceDocumentId: documentId });
    }, "The verified note is attached and the missing-note issue is resolved. Recheck the packet.");
  }

  return <div className="mt-6 border-t border-current/10 pt-5">
    <h3 className="font-semibold">Attach original synthetic note</h3>
    {existing ? <p className={`mt-2 text-sm ${muted(night)}`}>Nov 2 note already attached · {existing.verificationState}. Resolve it with this source.</p> : <><p className={`mt-2 text-sm ${muted(night)}`}>Select <code>fixtures/ur-1042/late-arrival/note-2026-11-02.md</code> from this project. Only that allowlisted synthetic content can be submitted.</p><input aria-label="Select synthetic November 2 note" type="file" accept=".md,text/markdown,text/plain" onChange={event => { void selectFile(event.target.files?.[0]); }} className="mt-4 block w-full text-sm" />{fileName && <p className={`mt-2 text-xs ${muted(night)}`}>Selected: {fileName}</p>}{content && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Preview original note</summary><pre className={`mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg p-3 text-xs ${night ? "bg-[#13251d]" : "bg-[#f4f7f3]"}`}>{content}</pre></details>}</>}
    {fileError && <p role="alert" className="mt-3 text-sm text-[#bc6552]">{fileError}</p>}
    <label className="mt-4 block text-sm">Resolution reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} className={`mt-2 w-full rounded-lg border px-3 py-2 outline-none focus:border-[#649b72] ${night ? "border-[#45614c] bg-[#15271e]" : "border-[#d1dfd3] bg-white"}`} /></label>
    <button type="button" disabled={action.busy || !reason.trim() || (!existing && !content)} onClick={() => { void attachAndResolve(); }} className={`${primary} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}>{action.busy ? "Saving…" : "Attach, verify and resolve"}</button>
    <ActionFeedback error={action.error} message={action.message} />
  </div>;
}

function DateResolution({ data, night, onChange, issueId }: Props & { issueId: string }) {
  const [reason, setReason] = useState("");
  const action = useAction(onChange);
  const period = data.detail.reviewPeriod;
  return <div className="mt-6 border-t border-current/10 pt-5">
    <h3 className="font-semibold">Clinician date verification</h3>
    <p className={`mt-2 text-sm ${muted(night)}`}>Confirm the requested Nov 4–6 period against the original request and explain why it extends beyond the Nov 1–3 authorization. Neither source is changed.</p>
    <label className="mt-4 block text-sm">Reason for the difference<textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={2000} placeholder="Record your source-backed verification reason" className={`mt-2 w-full rounded-lg border p-3 outline-none focus:border-[#649b72] ${night ? "border-[#45614c] bg-[#15271e]" : "border-[#d1dfd3] bg-white"}`} /></label>
    <button type="button" disabled={action.busy || !reason.trim() || !period?.sourceDocumentId} onClick={() => { void action.perform(async () => { if (!period?.sourceDocumentId) return; await writeApi(`/api/issues/${issueId}/resolve`, "POST", { resolution: "verify_period", reason: reason.trim(), evidenceDocumentId: period.sourceDocumentId, verifiedPeriod: { start: period.requestedStart, end: period.requestedEnd } }); }, "Dates verified with the original request. Recheck the packet before sign-off."); }} className={`${primary} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}>Record verification</button>
    <ActionFeedback error={action.error} message={action.message} />
  </div>;
}

export function AttachmentPanel(props: Props) {
  const { data, night, base } = props;
  const issue = data.issues.find(item => item.type === "missing_document");
  const document = data.documents.find(item => item.id === issue?.resolutionEvidenceId)
    ?? data.documents.find(item => item.type === "progress_note" && item.serviceDate === "2026-11-02" && item.verificationState !== "rejected");
  const resolved = issue?.status === "resolved";
  return <><PageHeading eyebrow="Original source document" title={resolved ? "Missing note attached" : "Attach missing progress note"} description="Preserve the original source, verify it, and record the resolution evidence." night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(290px,0.8fr)]"><section className={card(night)}>
      {document && <><h2 className="text-lg font-semibold">{document.title}</h2><dl className="mt-5 space-y-3 text-sm"><div><dt className={muted(night)}>Service date</dt><dd>{formatDate(document.serviceDate)}</dd></div><div><dt className={muted(night)}>Received</dt><dd>{formatDate(document.receivedAt, true)}</dd></div><div><dt className={muted(night)}>Author</dt><dd>{document.author ?? "Not recorded"}</dd></div><div><dt className={muted(night)}>Version · Verification</dt><dd>v{document.version} · {document.verificationState}</dd></div></dl><Link href={`${base}/evidence?document=${document.id}`} className={`${secondary(night)} mt-5`}>Inspect original source →</Link></>}
      {resolved ? <p className="mt-5 rounded-lg bg-[#649b72]/15 p-4 text-sm">Missing-note issue resolved with this source. {issue.resolutionReason}</p> : issue ? <MissingNoteResolution {...props} issueId={issue.id} /> : <p>No missing-note issue is available.</p>}
    </section><aside className={card(night)}><h2 className="text-lg font-semibold">Next: verify dates</h2><p className={`mt-4 text-sm leading-6 ${muted(night)}`}>Requested {formatDate(data.detail.reviewPeriod?.requestedStart ?? null)} – {formatDate(data.detail.reviewPeriod?.requestedEnd ?? null)}.</p><p className={`mt-2 text-sm leading-6 ${muted(night)}`}>Authorized {formatDate(data.detail.authorization?.approvedStart ?? null)} – {formatDate(data.detail.authorization?.approvedEnd ?? null)}.</p><p className={`mt-4 text-sm leading-6 ${muted(night)}`}>Both periods need source review and a written reason. The original dates remain intact.</p><Link href={`${base}/dates`} className={`${primary} mt-5`}>Verify dates →</Link><Link href={`${base}/issues`} className="mt-4 block text-sm underline underline-offset-4">Return to issues</Link></aside></div></>;
}

function SourceRecord({ document, night, base }: { document: DocumentSummary | undefined; night: boolean; base: string }) {
  const [source, setSource] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    if (document) readApi<DocumentDetail>(`/api/documents/${document.id}`).then(value => { if (active) setSource(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [document]);
  return <div className="mt-3 border-t border-current/10 pt-3"><p className={`text-xs ${muted(night)}`}>{document ? `${document.title} · v${document.version} · ${document.verificationState}` : "Source unavailable"}</p>{source && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Read original source</summary><pre className={`mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg p-4 text-xs leading-6 ${night ? "bg-[#13251d]" : "bg-[#f4f7f3]"}`}>{source.content}</pre></details>}{error && <p role="alert" className="mt-3 text-sm text-[#b45f4b]">Source could not load. Review it in Evidence before recording verification.</p>}{document && <Link href={`${base}/evidence?document=${document.id}`} className="mt-3 inline-block text-xs underline underline-offset-4">Open source in Evidence →</Link>}</div>;
}

export function DatesPanel(props: Props) {
  const { data, night, base } = props;
  const issue = data.issues.find(item => item.type === "date_conflict");
  return <><PageHeading eyebrow="Clinician source verification" title="Verify review dates" description="Keep both periods distinct and explain the difference." night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(290px,0.8fr)]"><section className={card(night)}><h2 className="text-lg font-semibold">Periods and sources</h2><div className="mt-6 space-y-6"><section><h3 className={`text-xs font-bold tracking-wider ${muted(night)}`}>EXISTING AUTHORIZATION</h3><p className="mt-2 text-lg">{formatDate(data.detail.authorization?.approvedStart ?? null)} – {formatDate(data.detail.authorization?.approvedEnd ?? null)}</p><SourceRecord document={data.documents.find(item => item.id === data.detail.authorization?.sourceDocumentId)} night={night} base={base} /></section><section><h3 className={`text-xs font-bold tracking-wider ${muted(night)}`}>REQUESTED REVIEW PERIOD</h3><p className="mt-2 text-lg">{formatDate(data.detail.reviewPeriod?.requestedStart ?? null)} – {formatDate(data.detail.reviewPeriod?.requestedEnd ?? null)}</p><SourceRecord document={data.documents.find(item => item.id === data.detail.reviewPeriod?.sourceDocumentId)} night={night} base={base} /></section></div>{issue?.status === "open" && <DateResolution {...props} issueId={issue.id} />}</section><aside className={card(night)}><h2 className="text-lg font-semibold">Verification record</h2><p className={`mt-4 text-sm leading-6 ${muted(night)}`}>{data.detail.reviewPeriod?.verifiedBy ? "Requested dates verified by the clinician." : "Requested dates have not yet been verified."}</p>{issue?.status === "resolved" && <p className="mt-4 rounded-lg bg-[#649b72]/15 p-4 text-sm">{issue.resolutionReason}</p>}<p className={`mt-4 text-sm leading-6 ${muted(night)}`}>The verification records the requested period and supporting source. It does not alter the authorization.</p><Link href={`${base}/recheck`} className={`${primary} mt-5`}>Recheck packet →</Link><Link href={`${base}/issues`} className="mt-4 block text-sm underline underline-offset-4">Return to issues</Link></aside></div></>;
}

export function RecheckPanel({ data, night, base, caseId, onChange }: Props) {
  const { run, validation } = data;
  const action = useAction(onChange);
  const names: Record<string, string> = { clinical_documentation: "Clinical Documentation", case_assembly_drafting: "Case Assembly and Drafting", independent_quality: "Independent Quality" };
  return <>
    <PageHeading eyebrow="Three-agent review" title={run && ["partial", "failed", "budget_exceeded"].includes(run.status) ? "Agent run incomplete" : "Packet recheck"} description={run && ["partial", "failed", "budget_exceeded"].includes(run.status) ? "Completed work remains visible. Sign-off stays blocked until the run completes." : "See each agent result and the code checks tied to the current packet."} night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(290px,0.85fr)]">
      <section className={card(night)}><h2 className="text-lg font-semibold">{run ? `Latest run · ${statusLabel(run.status)}` : "No review run yet"}</h2><p className={`mt-2 text-sm ${muted(night)}`}>{run?.startedAt ? `Started ${formatDate(run.startedAt, true)}` : "A run will prepare the first versioned packet."}</p><div className="mt-6 space-y-3">{run?.agents.map(agent => <div key={agent.agent} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${night ? "border-[#355340]" : "border-[#e1e9e1]"}`}><span className="font-semibold">{names[agent.agent] ?? agent.agent}</span><span className={agent.status === "succeeded" ? "text-[#5b9c65]" : agent.status === "failed" || agent.status === "timed_out" ? "text-[#bd6b54]" : muted(night)}>{statusLabel(agent.status)}</span>{agent.attempts > 0 && <span className={`text-xs ${muted(night)}`}>{agent.attempts} attempt{agent.attempts === 1 ? "" : "s"}</span>}{agent.message && <p className={`w-full text-xs ${muted(night)}`}>{agent.message}</p>}</div>)}{!run && <p className={muted(night)}>The app preserves each result and shows failed or timed-out agents by name.</p>}</div><div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={action.busy || run?.status === "running"} onClick={() => { void action.perform(async () => { await writeApi(`/api/cases/${encodeURIComponent(caseId)}/runs`, "POST", {}); }, "Review run started. Status will update as each agent finishes."); }} className={`${primary} disabled:cursor-not-allowed disabled:opacity-50`}>{run?.status === "running" ? "Run in progress…" : run && ["partial", "failed", "budget_exceeded"].includes(run.status) ? "Retry review run" : run ? "Run review again" : "Start review run"}</button><Link href={`${base}/approval`} className={secondary(night)}>Review sign-off gate →</Link></div><ActionFeedback error={action.error} message={action.message} /></section>
      <section className={card(night)}><h2 className="text-lg font-semibold">Deterministic validation</h2><ul className="mt-5 space-y-3 text-sm">{validation.report.checks.map((check, index) => <li key={`${check.name}-${index}`} className="flex items-start justify-between gap-3"><span>{check.name.replaceAll("_", " ")}</span><span className={check.result === "pass" ? "text-[#5b9c65]" : check.result === "fail" ? "text-[#bd6b54]" : muted(night)}>{statusLabel(check.result)}</span></li>)}</ul><p className={`mt-5 text-sm ${muted(night)}`}>{validation.blockers.length} current blocker{validation.blockers.length === 1 ? "" : "s"}. An incomplete run always blocks sign-off.</p></section>
    </div>
  </>;
}

export function ApprovalPanel({ data, night, base, caseId, onChange }: Props) {
  const { detail, claims, validation } = data;
  const [acknowledged, setAcknowledged] = useState(false);
  const action = useAction(onChange);
  const ready = canSignOff(data);
  const signed = detail.case.status === "approved_for_submission";
  return <>
    <PageHeading eyebrow="Human approval gate" title={detail.case.status === "approved_for_submission" ? "Packet signed off" : ready ? "Ready for sign-off" : "Sign-off blocked"} description="Review the exact packet version and its validation result before confirming." night={night} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.85fr)]">
      <section className={card(night)}><div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 pb-4"><h2 className="text-lg font-semibold">Packet {detail.latestPacketVersion ? `v${detail.latestPacketVersion.version}` : "pending"} · Read-only preview</h2><span className={`text-xs ${muted(night)}`}>Exact version only</span></div><div className="mt-5 space-y-3 text-sm"><p>Requested: {formatDate(detail.reviewPeriod?.requestedStart ?? null)} – {formatDate(detail.reviewPeriod?.requestedEnd ?? null)}</p><p>Authorized: {formatDate(detail.authorization?.approvedStart ?? null)} – {formatDate(detail.authorization?.approvedEnd ?? null)}</p></div><div className="mt-5 space-y-3">{claims.filter(claim => claim.status !== "rejected").map(claim => <p key={claim.id} className={`rounded-lg p-3 text-sm leading-6 ${night ? "bg-[#13251d]" : "bg-[#f5f8f4]"}`}>{claim.text}</p>)}</div><p className={`mt-5 break-all text-xs ${muted(night)}`}>Packet hash: {validation.contentHash ?? "Not available"}</p><Link href={`${base}/evidence`} className={`${secondary(night)} mt-5`}>Review evidence →</Link></section>
      <section className={card(night)}><h2 className="text-lg font-semibold">Validation result</h2><p className={`mt-3 text-sm font-semibold ${ready ? "text-[#5a9c66]" : "text-[#aa7435]"}`}>{(ready || signed) ? "All checks clear" : `${validation.blockers.length} blocker${validation.blockers.length === 1 ? "" : "s"} remain`}</p><ul className="mt-5 space-y-3 text-sm">{validation.report.checks.map((check, index) => <li key={`${check.name}-${index}`} className="flex justify-between gap-3"><span>{check.name.replaceAll("_", " ")}</span><strong className={check.result === "pass" ? "text-[#5a9c66]" : "text-[#aa7435]"}>{statusLabel(check.result)}</strong></li>)}</ul><ul className="mt-5 space-y-3 text-sm">{validation.blockers.map((blocker, index) => <li key={`${blocker.code}-${blocker.objectId ?? index}`} className={`rounded-lg p-3 ${night ? "bg-[#4a3928]" : "bg-[#fbf2e5]"}`}>{blocker.code === "hash_mismatch" && !detail.latestPacketVersion ? "No prepared packet is available yet. Start a review run, then inspect the resulting packet." : blocker.message}{blocker.objectId ? <span className={`mt-1 block text-xs ${muted(night)}`}>{blocker.objectId}</span> : null}</li>)}</ul>{!ready && !signed && <button type="button" disabled className={`${primary} mt-5 w-full cursor-not-allowed opacity-50`}>Sign off unavailable</button>}{!ready && !signed && <Link href={`${base}/issues`} className={`${secondary(night)} mt-6`}>Resolve blockers →</Link>}{ready && !signed && <><label className="mt-6 flex items-start gap-3 text-sm"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} className="mt-1 size-4 accent-[#255e4b]" /><span>I reviewed the clinical statements and their sources in this exact packet version.</span></label><button type="button" disabled={!acknowledged || action.busy} onClick={() => { void action.perform(async () => { await writeApi(`/api/cases/${encodeURIComponent(caseId)}/approve`, "POST", { packetVersionId: validation.packetVersionId, contentHash: validation.contentHash, acknowledgement: "I reviewed the clinical statements and their sources in this exact packet version." }); setAcknowledged(false); }, "The exact packet version was signed off. Nothing was sent to a payer."); }} className={`${primary} mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50`}>{action.busy ? "Signing off…" : `Sign off packet v${detail.latestPacketVersion?.version ?? "?"}`}</button></>}{signed && <div className="mt-6 rounded-lg bg-[#4c9a60]/15 p-4 text-sm"><h3 className="font-semibold text-[#60a96f]">Packet signed off</h3><p className="mt-3">Version {detail.latestPacketVersion?.version} · Clinician sign-off is recorded for this exact version.</p><p className={`mt-3 break-all text-xs ${muted(night)}`}>Hash: {validation.contentHash}</p><p className="mt-4 leading-6">A later source or packet change requires validation and fresh clinician sign-off. Nothing was sent to a payer.</p><Link href="/" className={`${secondary(night)} mt-4`}>Return to queue →</Link></div>}<ActionFeedback error={action.error} message={action.message} /></section>
    </div>
  </>;
}
