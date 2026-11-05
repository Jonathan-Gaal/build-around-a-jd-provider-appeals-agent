import "../scripts/load-env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { connectDatabase } from "../lib/db";
import * as s from "../lib/db/schema";
import { seed, DEMO_ACCOUNTS } from "../lib/db/seed";
import { getEnv } from "../lib/env";
import { authorizeDemoLogin } from "../lib/auth/login";
import type { SessionUser } from "../lib/auth/access";
import { handleApi } from "../lib/http/api";
import { executeGroup } from "../lib/orchestrator/run";
import { createSpendLedger } from "../lib/db/spend-ledger";
import { parseFrontMatter } from "../lib/fixtures/load-fixture";
import type { ClaudeClient } from "../lib/harness/run-agent";

const env = getEnv();
assert(env.DATABASE_URL && new URL(env.DATABASE_URL).pathname.endsWith("_test"));
assert.equal(env.APP_DEPLOYMENT, "local");
assert(["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname));
const { db, pool } = connectDatabase(env.DATABASE_URL);
const local = { ...env, APP_ORIGIN: "http://localhost:3000", AGENT_REPLAY: true };
let actor: SessionUser | null = null;
const scheduled: string[] = [];
const ids = new Map<string, string>();
const identifier = z.object({ id: z.string() });
async function api(method: string, path: string, body?: unknown) {
 return handleApi(new Request(`http://localhost:3000/api/${path}`, { method, headers: { "Content-Type": "application/json", Origin: local.APP_ORIGIN }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), path.split("/"), { db, session: async () => actor, schedule: id => scheduled.push(id), env: local });
}
async function okay(method: string, path: string, body?: unknown): Promise<unknown> {
 const response = await api(method, path, body); const data: unknown = await response.json();
 assert.equal(response.status, 200, `${method} ${path}: ${JSON.stringify(data)}`); return data;
}
function as(account: string) { const entry = DEMO_ACCOUNTS.find(user => user.accountKey === account)!; actor = { userId: ids.get(account)!, role: entry.role }; }
const fake: ClaudeClient = { messages: { parse: async params => {
 const [note] = await db.select().from(s.documents).where(and(eq(s.documents.caseId, "UR-1042"), eq(s.documents.type, "progress_note"), eq(s.documents.serviceDate, "2026-11-03")));
 const quote = note.content.split(/\r?\n/).find(line => line.startsWith("Subjective:"))!;
 const system = JSON.stringify(params.system);
 const output: unknown = system.includes("Clinical Documentation agent") ? { facts: [{ id: "f1", category: "symptoms", statement: quote, serviceDate: note.serviceDate, quotes: [{ documentId: note.id, text: quote }] }], gaps: [] } : system.includes("Case Assembly and Drafting agent") ? { mode: "review_packet", sections: [{ heading: "Current documentation", claims: [{ text: quote, sourceKind: "extracted_fact", factIds: ["f1"] }] }], openQuestions: [] } : { checks: [{ name: "support", result: "pass", detail: "Synthetic role test", affected: [] }], issues: [] };
 return { parsed_output: output, usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: "end_turn" };
} } };
async function main() {
 assert.equal((await db.select().from(s.cases).limit(1)).length, 0, "Fresh test DB required");
 await seed(db); await seed(db);
 for (const account of DEMO_ACCOUNTS) {
  const credential = `synthetic-${account.accountKey}-test-only-credential`;
  const result = await authorizeDemoLogin({ account: account.accountKey, credential, role: "clinician" }, "role-test", db, { demoCredentials: { [account.accountKey]: credential } });
  assert.equal(result.status, "ok"); if (result.status !== "ok") throw new Error("login_failed");
  assert.equal(result.user.role, account.role); ids.set(account.accountKey, result.user.id);
 }
 assert.equal(new Set(ids.values()).size, 5, "Each account has its own persisted identity");
 assert.equal((await api("GET", "cases")).status, 401);
 as("clinician_b"); assert.deepEqual(await okay("GET", "cases"), []);
 assert.equal((await api("GET", "cases/UR-1042")).status, 404);
 as("packet_a"); assert.deepEqual(await okay("GET", "cases"), []);
 assert.equal((await api("GET", "cases/UR-1042/packet")).status, 409);
 assert.equal((await api("GET", "cases/UR-1042")).status, 403);
 as("coordinator_a");
 assert.equal(z.array(z.unknown()).parse(await okay("GET", "cases")).length, 1);
 const raw = parseFrontMatter(await readFile("fixtures/ur-1042/late-arrival/note-2026-11-02.md", "utf8"));
 const uploaded = identifier.parse(await okay("POST", "cases/UR-1042/documents", { type: "progress_note", title: "Synthetic late note", content: raw.body }));
 assert.equal((await api("POST", `documents/${uploaded.id}/verify`, { decision: "verified" })).status, 403);
 const [unverified] = await db.select().from(s.documents).where(eq(s.documents.id, uploaded.id)); assert.equal(unverified.verificationState, "unverified"); assert.equal(unverified.uploadedBy, ids.get("coordinator_a"));
 as("clinician_a"); await okay("POST", `documents/${uploaded.id}/verify`, { decision: "verified" });
 const run = scheduled.shift()!; assert(run);
 // An active run cannot be reassigned.
 as("manager_a");
 assert.equal((await api("PATCH", "cases/UR-1042/assignment", { assignedTo: ids.get("clinician_b"), expectedAssignedTo: ids.get("clinician_a") })).status, 409);
 await executeGroup(db, run, { client: fake, env: { ...local, AGENT_REPLAY: false }, replay: "off", spend: { ledger: createSpendLedger(db), environment: "local", agentRunRef: run } });
 as("clinician_a");
 const issues = z.array(z.object({ id: z.string(), type: z.string() })).parse(await okay("GET", "cases/UR-1042/issues"));
 await okay("POST", `issues/${issues.find(issue => issue.type === "missing_document")!.id}/resolve`, { resolution: "attach_document", reason: "Clinician checked the source attached by coordinator", evidenceDocumentId: uploaded.id });
 const detail = z.object({ reviewPeriod: z.object({ sourceDocumentId: z.string() }) }).parse(await okay("GET", "cases/UR-1042"));
 await okay("POST", `issues/${issues.find(issue => issue.type === "date_conflict")!.id}/resolve`, { resolution: "verify_period", reason: "Requested Nov4–6 differs from authorized Nov1–3", evidenceDocumentId: detail.reviewPeriod.sourceDocumentId, verifiedPeriod: { start: "2026-11-04", end: "2026-11-06" } });
 const validation = z.object({ packetVersionId: z.string(), contentHash: z.string(), blockers: z.array(z.unknown()) }).parse(await okay("GET", "cases/UR-1042/validation")); assert.deepEqual(validation.blockers, []);
 const approvalBody = { packetVersionId: validation.packetVersionId, contentHash: validation.contentHash, acknowledgement: "Clinician reviewed all synthetic sources" };
 const claims = z.array(identifier).parse(await okay("GET", "cases/UR-1042/claims"));
 for (const account of ["coordinator_a", "manager_a", "packet_a"]) {
  as(account);
  for (const [method, path, body] of [["POST", "cases/UR-1042/approve", approvalBody], ["POST", "cases/UR-1042/runs", {}], ["PATCH", `claims/${claims[0].id}`, { text: "Unauthorized change" }], ["POST", `documents/${uploaded.id}/verify`, { decision: "verified" }], ["POST", `issues/${issues[0].id}/resolve`, {}]] as const) assert.equal((await api(method, path, body)).status, 403, `${account} must not ${path}`);
 }
 as("clinician_a"); const approval = identifier.parse(await okay("POST", "cases/UR-1042/approve", approvalBody));
 as("packet_a"); assert.equal(z.array(z.unknown()).parse(await okay("GET", "cases")).length, 1);
 const packet = z.object({ packetVersionId: z.string(), contentHash: z.string() }).parse(await okay("GET", "cases/UR-1042/packet")); assert.equal(packet.contentHash, validation.contentHash); assert.equal(packet.packetVersionId, validation.packetVersionId);
 assert.equal((await api("GET", `documents/${uploaded.id}`)).status, 403);
 as("manager_a"); const team = z.array(identifier).parse(await okay("GET", "cases/UR-1042/team")); assert.equal(team.length, 2);
 assert.equal((await api("PATCH", "cases/UR-1042/assignment", { assignedTo: ids.get("coordinator_a"), expectedAssignedTo: ids.get("clinician_a") })).status, 422);
 await okay("PATCH", "cases/UR-1042/assignment", { assignedTo: ids.get("clinician_b"), expectedAssignedTo: ids.get("clinician_a") });
 assert.equal((await api("PATCH", "cases/UR-1042/assignment", { assignedTo: ids.get("clinician_a"), expectedAssignedTo: ids.get("clinician_a") })).status, 409);
 const [saved] = await db.select().from(s.approvals).where(eq(s.approvals.id, approval.id)); assert.equal(saved.status, "invalidated"); assert.equal(saved.invalidatedReason, "assignment_changed");
 as("clinician_a"); assert.deepEqual(await okay("GET", "cases"), []); assert.equal((await api("GET", "cases/UR-1042")).status, 404); assert.equal((await api("POST", "cases/UR-1042/approve", approvalBody)).status, 404);
 as("clinician_b"); await okay("GET", "cases/UR-1042"); const renewed = identifier.parse(await okay("POST", "cases/UR-1042/approve", approvalBody)); assert.notEqual(renewed.id, approval.id);
 // Explicit membership revocation takes effect on the next request.
 const coordinatorId = ids.get("coordinator_a")!;
 await db.delete(s.caseMembers).where(and(eq(s.caseMembers.caseId, "UR-1042"), eq(s.caseMembers.userId, coordinatorId)));
 as("coordinator_a"); assert.deepEqual(await okay("GET", "cases"), []); assert.equal((await api("GET", "cases/UR-1042")).status, 404); assert.equal((await api("GET", `documents/${uploaded.id}`)).status, 404);
 const stranger = randomUUID(); await db.insert(s.users).values({ id: stranger, accountKey: "unassigned_manager", email: "unassigned_manager@example.test", name: "Synthetic unassigned manager", role: "supervisor" }); actor = { userId: stranger, role: "supervisor" };
 assert.deepEqual(await okay("GET", "cases"), []); assert.equal((await api("GET", "cases/UR-1042/team")).status, 404);
 console.log(JSON.stringify({ passed: true, distinctAccounts: 5, realPostgres: true, liveModelCalls: 0, checks: ["per-role login", "default deny", "case membership", "coordinator unverified upload", "clinician-only clinical actions", "active-run assignment refusal", "approved-packet-only access", "optimistic reassignment", "immediate old-clinician revocation", "approval invalidation", "new-clinician approval", "membership revocation", "unassigned manager isolation"] }, null, 2));
}
main().finally(() => pool.end());
