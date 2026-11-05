/** Failure injection against the existing backend. Local, fresh synthetic DB only. */
import "../scripts/load-env";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { connectDatabase } from "../lib/db";
import * as s from "../lib/db/schema";
import { seed, DEMO_USER_ID } from "../lib/db/seed";
import { getEnv } from "../lib/env";
import { handleApi } from "../lib/http/api";
import { executeGroup } from "../lib/orchestrator/run";
import { createSpendLedger } from "../lib/db/spend-ledger";
import { parseFrontMatter } from "../lib/fixtures/load-fixture";
import type { ClaudeClient } from "../lib/harness/run-agent";

const scenarios = ["success", "clinical_api", "assembly_api", "quality_api", "clinical_schema", "assembly_schema", "quality_schema", "clinical_timeout", "assembly_timeout", "quality_timeout", "clinical_recover", "assembly_recover", "quality_recover", "unsupported_quote", "unknown_fact", "duplicate_fact", "quality_finding", "stale_inputs"] as const;
const scenario = z.enum(scenarios).parse(process.argv[2]);
const env = getEnv();
assert.equal(env.APP_DEPLOYMENT, "local");
assert(env.DATABASE_URL && new URL(env.DATABASE_URL).pathname.endsWith("_test"));
assert(["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname));
const { db, pool } = connectDatabase(env.DATABASE_URL);
const local = { ...env, APP_ORIGIN: "http://localhost:3000", AGENT_REPLAY: true, AGENT_RECORD: false };
const scheduled: string[] = [];
const names = ["clinical_documentation", "case_assembly_drafting", "independent_quality"] as const;
const short = ["clinical", "assembly", "quality"] as const;
type Agent = typeof short[number];
const counts = { clinical: 0, assembly: 0, quality: 0 };
const handoffs: string[] = [];
let concurrentDocumentId: string | null = null;
async function api(method: string, path: string, body?: unknown) {
  return handleApi(new Request(`http://localhost:3000/api/${path}`, { method, headers: { "Content-Type": "application/json", Origin: local.APP_ORIGIN }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), path.split("/"), { db, session: async () => ({ userId: DEMO_USER_ID, role: "clinician" }), schedule: id => scheduled.push(id), env: local });
}
async function okay(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await api(method, path, body);
  const value: unknown = await response.json();
  assert.equal(response.status, 200, `${method} ${path}: ${JSON.stringify(value)}`);
  return value;
}
const identifier = z.object({ id: z.string() });
const validationSchema = z.object({ packetVersionId: z.string().nullable(), contentHash: z.string().nullable(), blockers: z.array(z.object({ code: z.string() })) });
function client(inject: boolean): ClaudeClient {
  const attempts = { clinical: 0, assembly: 0, quality: 0 };
  return { messages: { parse: async params => {
    const system = JSON.stringify(params.system);
    const agent: Agent = system.includes("Clinical Documentation agent") ? "clinical" : system.includes("Case Assembly and Drafting agent") ? "assembly" : "quality";
    attempts[agent]++; if (inject) counts[agent]++;
    const [note] = await db.select().from(s.documents).where(and(eq(s.documents.caseId, "UR-1042"), eq(s.documents.type, "progress_note"), eq(s.documents.serviceDate, "2026-11-03")));
    const quote = note.content.split(/\r?\n/).find(line => line.startsWith("Subjective:"));
    assert(quote);
    const prompt = JSON.stringify(params.messages);
    if (inject && agent !== "clinical") {
      assert(prompt.includes("f1") && prompt.includes(note.id), "Handoff must include fact and original source");
      for (const date of ["2026-11-01", "2026-11-03", "2026-11-04", "2026-11-06"]) assert(prompt.includes(date), "Requested and authorized periods must both survive handoff");
      if (agent === "quality") assert(prompt.includes("draft"), "Quality must receive the draft alongside original sources");
      handoffs.push(agent);
    }
    if (inject && scenario === `${agent}_api`) throw new Error("synthetic_api_failure");
    if (inject && scenario === `${agent}_timeout`) throw new Anthropic.APIConnectionTimeoutError();
    if (inject && scenario === `${agent}_recover` && attempts[agent] === 1) throw new Error("synthetic_transient_failure");
    let output: unknown;
    if (agent === "clinical") {
      const fact = { id: "f1", category: "symptoms", statement: quote, serviceDate: note.serviceDate, quotes: [{ documentId: note.id, text: inject && scenario === "unsupported_quote" ? "SYNTHETIC QUOTE THAT DOES NOT EXIST IN THE SOURCE" : quote }] };
      output = { facts: inject && scenario === "duplicate_fact" ? [fact, fact] : [fact], gaps: [] };
    } else if (agent === "assembly") output = { mode: "review_packet", sections: [{ heading: "Current documentation", claims: [{ text: quote, sourceKind: "extracted_fact", factIds: [inject && scenario === "unknown_fact" ? "missing-fact" : "f1"] }] }], openQuestions: [] };
    else {
      output = { checks: [{ name: "support", result: inject && scenario === "quality_finding" ? "fail" : "pass", detail: "Synthetic failure-matrix check", affected: [] }], issues: [] };
      if (inject && scenario === "stale_inputs") {
        // A new immutable source arrives while Quality is working. Never edit an original.
        const content = "Synthetic additional source for stale-input testing only.";
        const id = randomUUID();
        await db.insert(s.documents).values({ id, caseId: "UR-1042", type: "progress_note", title: "Synthetic concurrent arrival", serviceDate: "2026-11-03", version: 2, content, contentHash: createHash("sha256").update(content).digest("hex"), verificationState: "verified", verificationSource: "seed", origin: "seed" });
        concurrentDocumentId = id;
      }
    }
    if (inject && scenario === `${agent}_schema`) output = { invalid: true };
    return { parsed_output: output, usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: "end_turn" };
  } } };
}
async function execute(id: string, inject: boolean) {
  await executeGroup(db, id, { client: client(inject), env: { ...local, AGENT_REPLAY: false }, replay: "off", spend: { ledger: createSpendLedger(db), environment: "local", agentRunRef: id } });
}
async function main() {
  assert.equal((await db.select().from(s.cases).limit(1)).length, 0, "Fresh test DB required");
  await seed(db);
  const originals = await db.select().from(s.documents);
  const note = parseFrontMatter(await readFile("fixtures/ur-1042/late-arrival/note-2026-11-02.md", "utf8"));
  const uploaded = identifier.parse(await okay("POST", "cases/UR-1042/documents", { type: "progress_note", title: "Synthetic late note", content: note.body }));
  await okay("POST", `documents/${uploaded.id}/verify`, { decision: "verified" });
  assert.equal(scheduled.length, 1);
  const baselineId = scheduled.shift()!;
  await execute(baselineId, false);
  const [baselineRun] = await db.select().from(s.runGroups).where(eq(s.runGroups.id, baselineId));
  assert.equal(baselineRun.status, "complete", JSON.stringify(await db.select({ agent: s.agentRuns.agent, status: s.agentRuns.status, error: s.agentRuns.error, errorKind: s.agentRuns.errorKind }).from(s.agentRuns).where(eq(s.agentRuns.runGroupId, baselineId))));
  const issues = z.array(z.object({ id: z.string(), type: z.string() })).parse(await okay("GET", "cases/UR-1042/issues"));
  await okay("POST", `issues/${issues.find(issue => issue.type === "missing_document")!.id}/resolve`, { resolution: "attach_document", reason: "Verified synthetic late note", evidenceDocumentId: uploaded.id });
  const detail = z.object({ reviewPeriod: z.object({ sourceDocumentId: z.string() }) }).parse(await okay("GET", "cases/UR-1042"));
  await okay("POST", `issues/${issues.find(issue => issue.type === "date_conflict")!.id}/resolve`, { resolution: "verify_period", reason: "Requested Nov4–6 and authorized Nov1–3 verified separately", evidenceDocumentId: detail.reviewPeriod.sourceDocumentId, verifiedPeriod: { start: "2026-11-04", end: "2026-11-06" } });
  const baseline = validationSchema.parse(await okay("GET", "cases/UR-1042/validation"));
  assert.deepEqual(baseline.blockers, []);
  const approval = identifier.parse(await okay("POST", "cases/UR-1042/approve", { packetVersionId: baseline.packetVersionId, contentHash: baseline.contentHash, acknowledgement: "Clinician reviewed the synthetic test packet" }));
  const group = z.object({ runGroupId: z.string() }).parse(await okay("POST", "cases/UR-1042/runs", {}));
  assert.equal((await api("POST", "cases/UR-1042/runs", {})).status, 409, "Overlapping runs must be refused");
  const pending = validationSchema.parse(await okay("GET", "cases/UR-1042/validation"));
  assert(pending.blockers.some(blocker => blocker.code === "run_incomplete"));
  await execute(group.runGroupId, true);
  for (const agent of ["assembly", "quality"] as const) assert.equal(handoffs.filter(handoff => handoff === agent).length, counts[agent], "Prompt/handoff assertions must pass independently of injected API errors");
  const runs = await db.select().from(s.agentRuns).where(eq(s.agentRuns.runGroupId, group.runGroupId));
  const ordered = names.map(name => runs.find(run => run.agent === name)!);
  const [record] = await db.select().from(s.runGroups).where(eq(s.runGroups.id, group.runGroupId));
  const current = validationSchema.parse(await okay("GET", "cases/UR-1042/validation"));
  const failure = scenario.match(/^(clinical|assembly|quality)_(api|schema|timeout)$/);
  const recovered = scenario.endsWith("_recover");
  if (failure) {
    const index = short.indexOf(failure[1] as Agent);
    assert.equal(record.status, index === 0 ? "failed" : "partial");
    ordered.forEach((run, i) => {
      assert.equal(run.status, i < index ? "succeeded" : i > index ? "skipped" : failure[2] === "timeout" ? "timed_out" : "failed");
      assert.equal(run.attempts, i < index ? 1 : i > index ? 0 : 2);
    });
    assert.equal(ordered[index].errorKind, failure[2]);
    assert.equal(current.packetVersionId, baseline.packetVersionId, "Failed runs preserve the previous packet");
  } else if (scenario === "duplicate_fact") {
    assert.equal(record.status, "failed"); assert.equal(ordered[0].errorKind, "schema");
    assert.deepEqual(ordered.map(run => run.status), ["failed", "skipped", "skipped"]);
  } else if (scenario === "stale_inputs") {
    assert(concurrentDocumentId, "A source must actually be persisted during Quality, not merely attempted");
    assert.equal((await db.select().from(s.documents).where(eq(s.documents.id, concurrentDocumentId))).length, 1);
    assert.deepEqual(ordered.map(run => run.attempts), [1, 1, 1], "The model calls succeed; publication fails because inputs changed");
    assert.equal(record.status, "partial"); assert.deepEqual(ordered.map(run => run.status), ["succeeded", "succeeded", "failed"]);
    assert.equal(current.packetVersionId, baseline.packetVersionId, "Stale candidate must never replace the packet");
  } else {
    assert.equal(record.status, "complete");
    if (recovered) for (let i = 0; i < short.length; i++) assert.equal(ordered[i].attempts, scenario.startsWith(short[i]) ? 2 : 1);
    if (scenario === "unsupported_quote" || scenario === "unknown_fact") {
      const claims = await db.select().from(s.claims).where(eq(s.claims.packetVersionId, current.packetVersionId!));
      assert.equal(claims.length, 1); assert.equal(claims[0].status, "unsupported");
      if (scenario === "unsupported_quote") assert.equal(ordered[0].status, "needs_review");
    }
  }
  const blocked = scenario !== "success" && !recovered;
  if (blocked) {
    assert(current.blockers.length > 0, "Failure cannot clear the human approval gate");
    const response = await api("POST", "cases/UR-1042/approve", { packetVersionId: current.packetVersionId, contentHash: current.contentHash, acknowledgement: "Synthetic approval must be refused while blocked" });
    assert.equal(response.status, 409);
  } else {
    assert.deepEqual(current.blockers, []);
    assert.equal(current.packetVersionId, baseline.packetVersionId, "Unchanged successful rerun reuses packet");
    const [saved] = await db.select().from(s.approvals).where(eq(s.approvals.id, approval.id));
    assert.equal(saved.status, "valid", "Identical output preserves exact-version approval");
  }
  const after = await db.select().from(s.documents);
  for (const original of originals) {
    const saved = after.find(doc => doc.id === original.id)!;
    assert.equal(saved.content, original.content); assert.equal(saved.contentHash, original.contentHash);
  }
  // Re-delivery of an already finished job must not call agents again.
  const beforeDuplicate = { ...counts }; await execute(group.runGroupId, true); assert.deepEqual(counts, beforeDuplicate);
  const report = { scenario, passed: true, mode: "fake clients + real backend/PostgreSQL", liveModelCalls: 0, groupStatus: record.status, agents: ordered.map(run => ({ agent: run.agent, status: run.status, attempts: run.attempts, errorKind: run.errorKind })), counts, handoffs, blockerCodes: current.blockers.map(blocker => blocker.code), approvalBlocked: blocked, originalSourcesUnchanged: true };
  await mkdir(".e2e-results/agent-loop", { recursive: true });
  await writeFile(`.e2e-results/agent-loop/${scenario}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main().finally(() => pool.end());
