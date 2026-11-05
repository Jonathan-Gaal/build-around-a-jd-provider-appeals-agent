export type CaseSummary = {
  id: string; patientLabel: string; type: string; levelOfCare: string;
  dueAt: string | null; status: string; issueCount: number;
  blockingIssueCount: number; lastUpdatedAt: string; overdue: boolean; synthetic: true;
};

export type CaseRecord = {
  id: string; type: string; patientLabel: string; service: string; levelOfCare: string;
  facility: string; payer: string; plan: string; dueAt: string | null;
  status: string; synthetic: true; updatedAt: string;
};
export type ReviewPeriod = {
  id: string; requestedStart: string; requestedEnd: string; version: number;
  sourceDocumentId: string | null; verifiedBy: string | null; verificationReason: string | null;
};
export type Authorization = {
  approvedStart: string; approvedEnd: string; authNumber: string; sourceDocumentId: string | null;
};
export type PacketVersion = { id: string; version: number; contentHash: string; createdAt: string; runGroupId: string | null };
export type CaseDetail = {
  case: CaseRecord; reviewPeriod: ReviewPeriod | null; authorization: Authorization | null;
  latestPacketVersion: PacketVersion | null; latestRunGroupId: string | null;
  demoClock: { enabled: boolean; now: string; timeZone: string }; prototype: true;
};
export type DocumentSummary = {
  id: string; type: string; title: string; author: string | null; serviceDate: string | null;
  version: number; verificationState: "verified" | "unverified" | "rejected"; receivedAt: string;
};
export type DocumentDetail = DocumentSummary & { content: string; origin: string; contentHash: string };
export type EvidenceSpan = { id: string; documentId: string; startOffset: number; endOffset: number; excerpt: string; method: string };
export type Claim = {
  id: string; packetVersionId: string; text: string; sectionHeading: string; position: number; status: string; displayStatus: string;
  sourceKind: string; material: boolean; boundaryFlagged: boolean; evidence: EvidenceSpan[];
};
export type Issue = {
  id: string; type: "missing_document" | "date_conflict" | "unsupported_claim" | "stale_policy" | "extraction_uncertain" | "insurer_objection" | "other"; severity: string; blocking: boolean;
  status: "open" | "awaiting_document" | "in_rework" | "escalated" | "resolved"; description: string; requiredDocumentType: string | null;
  requiredServiceDate: string | null; resolution: string | null; resolutionReason: string | null;
  resolutionEvidenceId: string | null; allowedResolutions: string[];
};
export type ClinicianIdentity = { id: string; name: string | null; role: string };
export type Blocker = { code: string; message: string; objectType?: string; objectId?: string };
export type Validation = {
  packetVersionId: string | null; contentHash: string | null;
  report: { checks: { name: string; result: "pass" | "fail" | "needs_review"; detail: string }[]; blockerCodes: string[] };
  blockers: Blocker[];
};
export type RunDetail = {
  id: string; status: "running" | "complete" | "partial" | "failed" | "budget_exceeded";
  startedAt: string; finishedAt: string | null; replayed: boolean;
  agents: { agent: string; status: string; errorKind: string | null; message: string | null; attempts: number }[];
};
