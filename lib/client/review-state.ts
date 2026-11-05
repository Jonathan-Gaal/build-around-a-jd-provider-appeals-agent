import type { CaseRecord, PacketVersion, RunDetail, Validation } from "./types";

export type SignOffSnapshot = {
  detail: { case: Pick<CaseRecord, "status">; latestPacketVersion: Pick<PacketVersion, "id" | "contentHash"> | null };
  validation: Pick<Validation, "packetVersionId" | "contentHash" | "blockers">;
  run: Pick<RunDetail, "status"> | null;
};

export function canSignOff({ detail, validation, run }: SignOffSnapshot): boolean {
  return detail.case.status !== "approved_for_submission"
    && run?.status === "complete"
    && validation.packetVersionId !== null
    && validation.packetVersionId === detail.latestPacketVersion?.id
    && validation.contentHash !== null
    && validation.contentHash === detail.latestPacketVersion?.contentHash
    && validation.blockers.length === 0;
}
