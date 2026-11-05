import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { z } from "zod";

const reportSchema = z.object({
  mode: z.string(), caseStatus: z.string(), liveModelCalls: z.literal(0), originalSourcesUnchanged: z.literal(true),
  requested: z.tuple([z.literal("2026-11-04"), z.literal("2026-11-06")]), authorized: z.tuple([z.literal("2026-11-01"), z.literal("2026-11-03")]),
  documentCount: z.literal(8), issues: z.array(z.object({ type: z.string(), status: z.string(), resolution: z.string().nullable() })),
  packets: z.array(z.object({ id: z.string(), version: z.number(), hash: z.string() })),
  approvals: z.array(z.object({ id: z.string(), packetVersionId: z.string(), hash: z.string(), actor: z.string(), createdAt: z.string(), status: z.string(), invalidatedReason: z.string().nullable() })),
  runs: z.array(z.object({ id: z.string(), status: z.string(), agents: z.array(z.object({ agent: z.string(), status: z.string(), attempts: z.number() })) })),
  auditActions: z.array(z.string()),
});
const load = (name: string) => reportSchema.parse(JSON.parse(readFileSync(`.e2e-results/${name}.json`, "utf8")));
const signed = load("signed-off"), changed = load("invalidated"), failed = load("failed-run");
assert.equal(signed.caseStatus, "approved_for_submission");
assert.equal(signed.approvals.length, 1);
assert.equal(signed.approvals[0].status, "valid");
assert.equal(signed.approvals[0].packetVersionId, signed.packets[0].id);
assert.equal(signed.approvals[0].hash, signed.packets[0].hash);
assert(signed.approvals[0].actor && signed.approvals[0].createdAt);
assert(signed.issues.every(issue => issue.status === "resolved"));
assert.equal(signed.runs[0].status, "complete");
assert(signed.runs[0].agents.every(agent => agent.status === "succeeded"));
assert(signed.auditActions.includes("packet_approved"));
assert.equal(changed.caseStatus, "needs_review");
assert.equal(changed.approvals[0].id, signed.approvals[0].id);
assert.equal(changed.approvals[0].status, "invalidated");
assert.equal(changed.approvals[0].invalidatedReason, "claim_changed");
assert.notEqual(changed.packets[0].id, signed.packets[0].id);
assert.equal(changed.packets.find(packet => packet.id === signed.packets[0].id)?.hash, signed.packets[0].hash);
assert(changed.auditActions.includes("approval_invalidated"));
assert.equal(failed.runs[0].status, "partial");
assert.equal(failed.runs[0].agents.filter(agent => agent.status === "succeeded").length, 2);
assert.equal(failed.runs[0].agents.find(agent => agent.agent === "independent_quality")?.status, "failed");
assert.equal(failed.runs[0].agents.find(agent => agent.agent === "independent_quality")?.attempts, 2);
assert.equal(failed.packets[0].id, changed.packets[0].id);
assert.equal(failed.approvals[0].status, "invalidated");
console.log(JSON.stringify({ passed: true, checkpoints: ["signed exact packet", "edit invalidates approval and preserves history", "failed Quality retains two completed agents"], originalSourcesUnchanged: true, periodsRemainSeparate: true, liveModelCalls: 0 }, null, 2));
