import { describe, expect, it } from "vitest";
import { canPreparePreviewHandoff, getSubmissionExample } from "./submission-preview";
import { applyPreviewAction, initialRolePreview, previewStateSchema } from "./role-preview";

describe("submission frontend preview boundaries", () => {
  it("blocks preparation without a signed-off example", () => { expect(canPreparePreviewHandoff(getSubmissionExample("pending"))).toBe(false); });
  it("accepts an exact example version and fingerprint", () => { expect(canPreparePreviewHandoff(getSubmissionExample("approved"))).toBe(true); });
  it("blocks a changed packet", () => { expect(canPreparePreviewHandoff(getSubmissionExample("changed"))).toBe(false); });
  it("checks version independently of fingerprint", () => { const value = getSubmissionExample("approved"); value.packet = { ...value.packet, version: 99 }; expect(canPreparePreviewHandoff(value)).toBe(false); });
  it("checks fingerprint independently of version", () => { const value = getSubmissionExample("approved"); value.packet = { ...value.packet, hash: "different" }; expect(canPreparePreviewHandoff(value)).toBe(false); });
  it("refuses receipt recording before preparation", () => {
    const state = { ...initialRolePreview, submissionScenario: "approved" as const };
    expect(applyPreviewAction(state, { type: "record_receipt", reference: "DEMO-1042-001", destination: "Offline handoff preview" }, "now", "e1")).toBe(state);
  });
  it("binds a demo receipt to the exact prepared version and preserves it as old after change", () => {
    const approved = { ...initialRolePreview, submissionScenario: "approved" as const };
    const prepared = applyPreviewAction(approved, { type: "prepare_handoff" }, "now", "e1");
    const recorded = applyPreviewAction(prepared, { type: "record_receipt", reference: "DEMO-1042-001", destination: "Offline handoff preview" }, "later", "e2");
    expect(recorded.receipt?.version).toBe(4);
    expect(recorded.receipt?.hash).toBe(prepared.preparedPacket?.hash);
    const changed = applyPreviewAction(recorded, { type: "submission_scenario", scenario: "changed" }, "later", "e3");
    expect(changed.preparedPacket).toBeNull();
    expect(changed.receipt).toEqual(recorded.receipt);
    expect(applyPreviewAction(changed, { type: "record_receipt", reference: "DEMO-1042-002", destination: "Offline handoff preview" }, "later", "e4")).toBe(changed);
  });
  it("accepts only a fictional receipt reference", () => {
    const prepared = applyPreviewAction({ ...initialRolePreview, submissionScenario: "approved" }, { type: "prepare_handoff" }, "now", "e1");
    expect(applyPreviewAction(prepared, { type: "record_receipt", reference: "real-receipt", destination: "Offline handoff preview" }, "now", "e2")).toBe(prepared);
  });
  it("hydrates older role previews without inventing a sign-off", () => {
    const { submissionScenario: _scenario, preparedPacket: _prepared, receipt: _receipt, ...older } = initialRolePreview;
    void _scenario; void _prepared; void _receipt;
    const restored = previewStateSchema.parse(older);
    expect(restored.submissionScenario).toBe("pending");
    expect(restored.receipt).toBeNull();
    expect(restored.preparedPacket).toBeNull();
  });
});
