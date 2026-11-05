import { readApi, readApiWithTestLabel } from "./api";
import type { CaseDetail, Claim, ClinicianIdentity, DocumentSummary, Issue, RunDetail, Validation } from "./types";

export type CaseSnapshot = {
  detail: CaseDetail; documents: DocumentSummary[]; claims: Claim[]; issues: Issue[];
  validation: Validation; run: RunDetail | null; clinician: ClinicianIdentity; isolatedTest: boolean;
};
const revision = (detail: CaseDetail) => JSON.stringify([detail.latestPacketVersion?.id, detail.latestPacketVersion?.contentHash, detail.latestRunGroupId, detail.reviewPeriod?.version, detail.case.status, detail.case.updatedAt]);

export async function readCaseSnapshot(caseId: string): Promise<CaseSnapshot> {
  const base = `/api/cases/${encodeURIComponent(caseId)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: detail, isolatedTest } = await readApiWithTestLabel<CaseDetail>(base);
    const [documents, claims, issues, validation, session, run] = await Promise.all([
      readApi<DocumentSummary[]>(`${base}/documents`),
      readApi<Claim[]>(detail.latestPacketVersion ? `${base}/claims?packetVersion=${detail.latestPacketVersion.id}` : `${base}/claims`),
      readApi<Issue[]>(`${base}/issues`), readApi<Validation>(`${base}/validation`),
      readApi<{ user?: ClinicianIdentity }>("/api/auth/session"),
      detail.latestRunGroupId ? readApi<RunDetail>(`/api/runs/${detail.latestRunGroupId}`) : Promise.resolve(null),
    ]);
    const current = await readApi<CaseDetail>(base);
    if (!session.user?.id) throw new Error("session_unavailable");
    if (revision(detail) !== revision(current) || validation.packetVersionId !== (detail.latestPacketVersion?.id ?? null)
      || claims.some(claim => claim.packetVersionId !== detail.latestPacketVersion?.id)) continue;
    return { detail, documents, claims, issues, validation, run, clinician: session.user, isolatedTest };
  }
  throw new Error("packet_changed_during_load");
}
