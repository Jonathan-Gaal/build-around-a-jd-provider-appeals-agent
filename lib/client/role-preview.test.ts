import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyPreviewAction, initialRolePreview } from "./role-preview";
import { previewNote } from "./role-preview-source";

describe("manager frontend preview", () => {
  it("changes assignment without changing source collection", () => {
    const next = applyPreviewAction(initialRolePreview, { type: "assign", assignee: "Jordan Lee, LCSW" }, "now", "event-1");
    expect(next.assignee).toBe("Jordan Lee, LCSW");
    expect(next.sourceAttached).toBe(false);
    expect(next.handoffAt).toBeNull();
    expect(next.escalation).toEqual(initialRolePreview.escalation);
  });
  it("routes escalation ownership without closing the source gap", () => {
    const next = applyPreviewAction(initialRolePreview, { type: "route", owner: "Clinician", reason: "Verify both source date ranges." }, "now", "event-1");
    expect(next.escalation.owner).toBe("Clinician");
    expect(next.escalation.status).toBe("routed");
    expect(next.sourceAttached).toBe(false);
    expect(next.handoffAt).toBeNull();
  });
  it("refuses a route without a reason", () => {
    expect(applyPreviewAction(initialRolePreview, { type: "route", owner: "Manager", reason: " " }, "now", "event-1")).toBe(initialRolePreview);
  });
});

describe("coordinator frontend preview", () => {
  it("blocks handoff while the original note is missing", () => {
    expect(applyPreviewAction(initialRolePreview, { type: "handoff" }, "2026-11-04T12:00:00Z", "event-1")).toBe(initialRolePreview);
  });
  it("hands off only after attaching the source and preserves date-review responsibility", () => {
    const attached = applyPreviewAction(initialRolePreview, { type: "attach_source" }, "2026-11-04T12:00:00Z", "event-1");
    const handed = applyPreviewAction(attached, { type: "handoff" }, "2026-11-04T12:01:00Z", "event-2");
    expect(handed.handoffAt).toBe("2026-11-04T12:01:00Z");
    expect(handed.events[0].message).toContain("Clinical issues remain for the clinician");
    expect(handed.escalation).toEqual(initialRolePreview.escalation);
    expect(initialRolePreview.sourceAttached).toBe(false);
  });
  it("does not record duplicate source attachments or handoffs", () => {
    const attached = applyPreviewAction(initialRolePreview, { type: "attach_source" }, "now", "event-1");
    expect(applyPreviewAction(attached, { type: "attach_source" }, "later", "event-2")).toBe(attached);
  });
  it("displays the exact original synthetic fixture rather than a reconstructed note", () => {
    const fixture = readFileSync("fixtures/ur-1042/late-arrival/note-2026-11-02.md", "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
    expect(previewNote.content.replaceAll("\r\n", "\n")).toBe(fixture.replaceAll("\r\n", "\n"));
    expect(createHash("sha256").update(previewNote.content).digest("hex")).toBe(previewNote.hash);
  });
});
