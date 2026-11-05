import type { CaseRecord, DocumentSummary, PacketVersion, RunDetail, Validation } from "./types";

export type SignOffSnapshot = {
  detail: { case: Pick<CaseRecord, "status">; latestPacketVersion: Pick<PacketVersion, "id" | "contentHash"> | null };
  validation: Pick<Validation, "packetVersionId" | "contentHash" | "blockers">;
  run: Pick<RunDetail, "status" | "startedAt"> | null;
  documents: Pick<DocumentSummary, "receivedAt">[];
};

export function isCurrentPacketValid({ detail, validation, run, documents }: SignOffSnapshot): boolean {
  return run?.status === "complete"
    && Number.isFinite(Date.parse(run.startedAt))
    && documents.every(document => Number.isFinite(Date.parse(document.receivedAt)) && Date.parse(document.receivedAt) <= Date.parse(run.startedAt))
    && validation.packetVersionId !== null
    && validation.packetVersionId === detail.latestPacketVersion?.id
    && validation.contentHash !== null
    && validation.contentHash === detail.latestPacketVersion?.contentHash
    && validation.blockers.length === 0;
}
export function canSignOff(data: SignOffSnapshot): boolean {
  return data.detail.case.status !== "approved_for_submission" && isCurrentPacketValid(data);
}
