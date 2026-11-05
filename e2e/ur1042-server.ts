/** Test-only frontend harness. Reuses production backend modules without editing them.
 * Auth.js runs in Next; the API verifies its real session cookie. Agent calls use
 * the existing integration-test client seam. No replay files or live calls.
 */
import "../scripts/load-env";
import assert from "node:assert/strict";
import { createServer, request as proxyRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { and, eq, desc } from "drizzle-orm";
import { getToken } from "next-auth/jwt";
import { getEnv } from "../lib/env";
import { connectDatabase } from "../lib/db";
import * as s from "../lib/db/schema";
import { seed, DEMO_USER_ID } from "../lib/db/seed";
import { handleApi } from "../lib/http/api";
import { executeGroup, startGroup } from "../lib/orchestrator/run";
import { withCaseLock } from "../lib/cases/lock";
import { createSpendLedger } from "../lib/db/spend-ledger";
import { loadValidation } from "../lib/validation/snapshot";
import type { ClaudeClient } from "../lib/harness/run-agent";

async function main() {
const env = getEnv();
const origin = env.APP_ORIGIN ?? "";
assert(["http://127.0.0.1:3002", "http://127.0.0.1:3004"].includes(origin), "Use the isolated test origin 127.0.0.1:3002 or 3004");
const uiPort = Number(new URL(origin).port), nextPort = uiPort + 1;
assert.equal(env.APP_DEPLOYMENT, "local", "E2E harness is local only");
assert(env.DATABASE_URL && new URL(env.DATABASE_URL).pathname.endsWith("_test"), "Requires a new isolated database ending _test");
assert(["127.0.0.1", "localhost"].includes(new URL(env.DATABASE_URL).hostname), "Local test PostgreSQL only");
assert(env.AUTH_SECRET && env.demoCredentials.clinician_a, "Configure the existing demo login");
const testEnv = { ...env, AGENT_REPLAY: true };
const outputDir = path.resolve(".e2e-results");
await mkdir(outputDir, { recursive: true });
const migration = spawnSync(process.execPath, ["--import=tsx", "--conditions=react-server", "scripts/db-migrate.ts"], { cwd: process.cwd(), env: process.env, encoding: "utf8" });
assert.equal(migration.status, 0, "Existing migrations must pass before frontend E2E");
const { db, pool } = connectDatabase(env.DATABASE_URL);
assert.equal((await db.select({ id: s.cases.id }).from(s.cases).limit(1)).length, 0, "Refusing to reuse a database with case data; create a fresh _test database");
await seed(db);
const originals = await db.select().from(s.documents).where(eq(s.documents.caseId, "UR-1042"));
let fakeModelCalls = 0, failNextQuality = false;
const pending = new Set<Promise<void>>();
function modelClient(failQuality: boolean): ClaudeClient {
  return { messages: { parse: async params => {
    fakeModelCalls++;
    const system = JSON.stringify(params.system);
    const [note] = await db.select().from(s.documents).where(and(eq(s.documents.caseId, "UR-1042"), eq(s.documents.type, "progress_note"), eq(s.documents.serviceDate, "2026-11-03")));
    const quote = note.content.split(/\r?\n/).find(line => line.startsWith("Subjective:"));
    assert(quote, "Existing fixture must supply the test quote");
    let output: unknown;
    if (system.includes("Clinical Documentation agent")) output = { facts: [{ id: "f1", category: "symptoms", statement: quote, serviceDate: note.serviceDate, quotes: [{ documentId: note.id, text: quote }] }], gaps: [] };
    else if (system.includes("Case Assembly and Drafting agent")) output = { mode: "review_packet", sections: [{ heading: "Current documentation", claims: [{ text: quote, sourceKind: "extracted_fact", factIds: ["f1"] }] }], openQuestions: [] };
    else {
      if (failQuality) throw new Error("synthetic_quality_failure_for_frontend_test");
      output = { checks: [{ name: "support", result: "pass", detail: "Deterministic test client; exact existing source quote", affected: [] }], issues: [] };
    }
    return { parsed_output: output, usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: "end_turn" };
  } } };
}
async function run(id: string, failure = false) {
  await executeGroup(db, id, { client: modelClient(failure), env: { ...testEnv, AGENT_REPLAY: false }, replay: "off", spend: { ledger: createSpendLedger(db), environment: "local", agentRunRef: id } });
}
function schedule(id: string) {
  const failure = failNextQuality; failNextQuality = false;
  const task = delay(600).then(() => run(id, failure)).finally(() => pending.delete(task));
  pending.add(task);
  void task.catch(() => console.error("E2E execution failed; inspect the persisted run status."));
}
// Seed a prepared initial packet using the exact backend test seam, not forged recordings.
const first = await withCaseLock(db, "UR-1042", tx => startGroup(tx, "UR-1042", DEMO_USER_ID, testEnv));
await run(first.runGroupId);
const initial = await loadValidation(db, "UR-1042");
assert(initial.packet && initial.blockers.length > 0, "Initial prepared packet must remain blocked");

const nextLog = createWriteStream(path.join(outputDir, "next.log"));
const next = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), ...(process.argv.includes("--dev") ? ["dev", "--turbopack"] : ["start"]), "--port", String(nextPort), "--hostname", "127.0.0.1"], {
  cwd: process.cwd(), env: { ...process.env, APP_DEPLOYMENT: "local", APP_ORIGIN: origin, DATABASE_URL: env.DATABASE_URL, AGENT_REPLAY: "1" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
next.stdout.pipe(nextLog); next.stderr.pipe(nextLog);
let nextReady = false;
for (let i = 0; i < 120; i++) {
  try { const response = await fetch(`http://127.0.0.1:${nextPort}/login`); if (response.ok) { nextReady = true; break; } } catch { /* Wait for Next to bind. */ }
  if (next.exitCode !== null) break;
  await delay(500);
}
assert(nextReady, "Next did not start; inspect .e2e-results/next.log");
function json(res: ServerResponse, value: unknown, status = 200) { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); }
async function report() {
  const [caseRecord] = await db.select().from(s.cases).where(eq(s.cases.id, "UR-1042"));
  const documents = await db.select().from(s.documents).where(eq(s.documents.caseId, "UR-1042"));
  const packets = await db.select().from(s.packetVersions).where(eq(s.packetVersions.caseId, "UR-1042")).orderBy(desc(s.packetVersions.version));
  const approvals = await db.select().from(s.approvals).where(eq(s.approvals.caseId, "UR-1042"));
  const issues = await db.select().from(s.issues).where(eq(s.issues.caseId, "UR-1042"));
  const runs = await db.select().from(s.runGroups).where(eq(s.runGroups.caseId, "UR-1042")).orderBy(desc(s.runGroups.startedAt));
  const agents = await db.select().from(s.agentRuns).where(eq(s.agentRuns.caseId, "UR-1042"));
  const audits = await db.select().from(s.auditEvents).where(eq(s.auditEvents.caseId, "UR-1042"));
  const [period] = await db.select().from(s.reviewPeriods).where(eq(s.reviewPeriods.caseId, "UR-1042")).orderBy(desc(s.reviewPeriods.version));
  const [authorization] = await db.select().from(s.authorizations).where(eq(s.authorizations.caseId, "UR-1042"));
  const value = {
    mode: "frontend browser + unchanged backend + real PostgreSQL + deterministic fake model clients",
    database: new URL(env.DATABASE_URL!).pathname.slice(1), liveModelCalls: 0, fakeModelCalls,
    caseStatus: caseRecord.status, originalSourcesUnchanged: originals.every(original => documents.some(document => document.id === original.id && document.content === original.content && document.contentHash === original.contentHash)),
    requested: [period.requestedStart, period.requestedEnd], authorized: [authorization.approvedStart, authorization.approvedEnd],
    documentCount: documents.length, issues: issues.map(issue => ({ type: issue.type, status: issue.status, resolution: issue.resolution })),
    packets: packets.map(packet => ({ id: packet.id, version: packet.version, hash: packet.contentHash })),
    approvals: approvals.map(approval => ({ id: approval.id, packetVersionId: approval.packetVersionId, hash: approval.contentHash, actor: approval.approvedBy, createdAt: approval.createdAt, status: approval.status, invalidatedReason: approval.invalidatedReason })),
    runs: runs.map(group => ({ id: group.id, status: group.status, agents: agents.filter(agent => agent.runGroupId === group.id).map(agent => ({ agent: agent.agent, status: agent.status, attempts: agent.attempts })) })),
    auditActions: audits.map(event => event.action),
  };
  await writeFile(path.join(outputDir, "backend-report.json"), JSON.stringify(value, null, 2));
  return value;
}
async function api(req: IncomingMessage, res: ServerResponse) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(",") : value);
  const request = new Request(origin + req.url, { method: req.method, headers, ...(["GET", "HEAD"].includes(req.method ?? "GET") ? {} : { body: Buffer.concat(chunks).toString("utf8") }) });
  const token = await getToken({ req: request, secret: env.AUTH_SECRET!, secureCookie: false });
  const actor = token && typeof token.userId === "string" && typeof token.role === "string" ? { userId: token.userId, role: token.role } : null;
  const response = await handleApi(request, new URL(request.url).pathname.slice(5).split("/"), { db, session: async () => actor, schedule, env: testEnv });
  res.writeHead(response.status, { ...Object.fromEntries(response.headers.entries()), "x-ur-e2e-mode": "fake-clients-isolated-db" });
  res.end(Buffer.from(await response.arrayBuffer()));
}
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", origin);
  if (url.pathname.startsWith("/__test/")) {
    if (url.pathname === "/__test/report" && req.method === "GET") { void report().then(value => json(res, value)).catch(() => json(res, { error: "report_failed" }, 500)); return; }
    if (req.method === "POST" && req.headers.origin === origin && url.pathname === "/__test/fail-next-quality") { failNextQuality = true; json(res, { mode: "test-only", nextQualityRun: "fails twice" }); return; }
    json(res, { error: "test_control_refused" }, 403); return;
  }
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/")) { void api(req, res).catch(() => json(res, { error: { code: "e2e_api_error" } }, 500)); return; }
  const upstream = proxyRequest({ hostname: "127.0.0.1", port: nextPort, path: req.url, method: req.method, headers: { ...req.headers, host: new URL(origin).host } }, response => { res.writeHead(response.statusCode ?? 502, response.headers); response.pipe(res); });
  upstream.on("error", () => { if (!res.headersSent) json(res, { error: "next_unavailable" }, 502); else res.end(); });
  req.pipe(upstream);
});
server.listen(uiPort, "127.0.0.1", () => console.log(JSON.stringify({ ready: true, origin, mode: "ISOLATED FRONTEND E2E · fake model clients, real backend and Auth.js", database: new URL(env.DATABASE_URL!).pathname.slice(1), liveModelCalls: 0 })));
async function shutdown() {
  server.close();
  if (next.pid && process.platform === "win32") spawnSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else next.kill("SIGTERM");
  await Promise.allSettled(pending); await report(); await pool.end(); process.exit(0);
}
process.once("SIGINT", () => { void shutdown(); }); process.once("SIGTERM", () => { void shutdown(); });

}
void main().catch(cause => { console.error("E2E setup failed:", cause instanceof Error ? cause.message.split("\n")[0] : "unknown error"); process.exitCode = 1; });
