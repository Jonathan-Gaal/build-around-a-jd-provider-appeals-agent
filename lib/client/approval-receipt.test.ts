import { describe, expect, it } from "vitest";
import { isReceiptCurrent, readApprovalReceipt, type ApprovalReceipt } from "./approval-receipt";
import type { SignOffSnapshot } from "./review-state";
const userId = "10000000-0000-4000-8000-000000000001";
const packetId = "20000000-0000-4000-8000-000000000002";
const hash = "a".repeat(64);
function receipt(): ApprovalReceipt { return { version: 4, record: { id: "30000000-0000-4000-8000-000000000003", caseId: "UR-1042", packetVersionId: packetId, contentHash: hash, approvedBy: userId, role: "clinician", acknowledgement: "Reviewed the exact packet", status: "valid", createdAt: "2026-11-03T21:22:00Z" } }; }
function snapshot(): SignOffSnapshot { return { detail: { case: { status: "approved_for_submission" }, latestPacketVersion: { id: packetId, contentHash: hash } }, validation: { packetVersionId: packetId, contentHash: hash, blockers: [] }, run: { status: "complete", startedAt: "2026-11-03T20:00:00Z" }, documents: [{ receivedAt: "2026-11-03T19:00:00Z" }] }; }
describe("server receipt display", () => {
  it("preserves the actual server timestamp, actor and fingerprint", () => { expect(readApprovalReceipt(JSON.stringify(receipt()), userId, "UR-1042")).toEqual(receipt()); });
  it("does not show another clinician's saved receipt", () => { expect(readApprovalReceipt(JSON.stringify(receipt()), "different-user", "UR-1042")).toBeNull(); });
  it("does not show another case's saved receipt", () => { expect(readApprovalReceipt(JSON.stringify(receipt()), userId, "UR-9999")).toBeNull(); });
  it("handles corrupt browser storage", () => { expect(readApprovalReceipt("invalid-json", userId, "UR-1042")).toBeNull(); });
  it("shows current only when server status and exact packet agree", () => { expect(isReceiptCurrent(receipt(), snapshot())).toBe(true); });
  it("never grants sign-off from a cached receipt", () => { const data = snapshot(); data.detail.case.status = "needs_review"; expect(isReceiptCurrent(receipt(), data)).toBe(false); });
  it("marks the receipt as previous after a packet change", () => { const data = snapshot(); data.detail.latestPacketVersion!.id = "new-packet"; expect(isReceiptCurrent(receipt(), data)).toBe(false); });
  it("does not show an approved state while the latest run is incomplete", () => { const data = snapshot(); data.run!.status = "partial"; expect(isReceiptCurrent(receipt(), data)).toBe(false); });
  it("does not show an approved state while a server blocker remains", () => { const data = snapshot(); data.validation.blockers.push({ code: "blocker", message: "Review needed" }); expect(isReceiptCurrent(receipt(), data)).toBe(false); });
});
