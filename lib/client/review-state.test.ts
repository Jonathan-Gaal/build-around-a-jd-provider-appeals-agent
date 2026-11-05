import { describe, expect, it } from "vitest";
import { canSignOff, type SignOffSnapshot } from "./review-state";

function state(): SignOffSnapshot {
  return { detail: { case: { status: "ready_for_approval" }, latestPacketVersion: { id: "packet-4", contentHash: "hash-4" } }, validation: { packetVersionId: "packet-4", contentHash: "hash-4", blockers: [] }, run: { status: "complete", startedAt: "2026-11-03T16:00:00Z" }, documents: [{ receivedAt: "2026-11-03T15:00:00Z" }] };
}
describe("frontend sign-off gate", () => {
  it("allows only a completed run and the exact current packet hash", () => { expect(canSignOff(state())).toBe(true); });
  it.each(["running", "partial", "failed", "budget_exceeded"] as const)("blocks %s runs even if no issue is listed", status => { const data = state(); data.run!.status = status; expect(canSignOff(data)).toBe(false); });
  it("blocks a missing run", () => { const data = state(); data.run = null; expect(canSignOff(data)).toBe(false); });
  it("blocks a mixed snapshot from a different packet", () => { const data = state(); data.validation.packetVersionId = "packet-3"; expect(canSignOff(data)).toBe(false); });
  it("blocks a changed packet hash", () => { const data = state(); data.validation.contentHash = "hash-5"; expect(canSignOff(data)).toBe(false); });
  it("blocks unresolved validation issues", () => { const data = state(); data.validation.blockers.push({ code: "missing_document", message: "Note missing" }); expect(canSignOff(data)).toBe(false); });
  it("does not offer duplicate sign-off", () => { const data = state(); data.detail.case.status = "approved_for_submission"; expect(canSignOff(data)).toBe(false); });
  it("requires recheck if a source arrived after the completed run", () => { const data = state(); data.documents.push({ receivedAt: "2026-11-03T17:00:00Z" }); expect(canSignOff(data)).toBe(false); });
  it("fails closed for an invalid run time", () => { const data = state(); data.run!.startedAt = "invalid"; expect(canSignOff(data)).toBe(false); });
});
