import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { connectDatabase, type Database, type Transaction } from "../lib/db";
import * as enums from "../lib/db/enums";
import * as s from "../lib/db/schema";
import { installInvariantChecks } from "../lib/db/security";
import { getEnv } from "../lib/env";

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

function postgresFailure(error: unknown, constraint: string, code = CHECK_VIOLATION): boolean {
  if (error === null || typeof error !== "object") return false;
  if ("code" in error && error.code === code && "constraint" in error && error.constraint === constraint) return true;
  return "cause" in error && postgresFailure(error.cause, constraint, code);
}

export async function testInvariantChecks(db: Database): Promise<void> {
  await installInvariantChecks(db);
  await installInvariantChecks(db);
  const [document] = await db.select({ id: s.documents.id }).from(s.documents).limit(1);
  assert.ok(document, "seeded_test_document_required");
  await assert.rejects(async () => db.execute(sql`UPDATE documents SET verification_state = 'bogus' WHERE id = ${document.id}`), (error) => postgresFailure(error, "document_verification_valid"));
  await assert.rejects(async () => db.execute(sql`UPDATE documents SET origin = 'bogus' WHERE id = ${document.id}`), (error) => postgresFailure(error, "document_origin_valid"));
  await assert.rejects(async () => db.execute(sql`UPDATE documents SET version = 0 WHERE id = ${document.id}`), (error) => postgresFailure(error, "document_version_positive"));
  await assert.rejects(async () => db.execute(sql`UPDATE spend_ledger SET recorded_usd = 'NaN'::numeric WHERE id = 'global'`), (error) => postgresFailure(error, "spend_finite"));
  await assert.rejects(async () => db.insert(s.spendReservations).values({ id: randomUUID(), environment: "bogus", estimateUsd: "0", status: "held" }), (error) => postgresFailure(error, "reservation_environment_valid"));
  await assert.rejects(async () => db.insert(s.spendReservations).values({ id: randomUUID(), environment: "eval", estimateUsd: "NaN", status: "held" }), (error) => postgresFailure(error, "reservation_amount_valid"));
  await assert.rejects(async () => db.insert(s.rateLimitCounters).values({ key: "synthetic-invalid-counter", windowStart: new Date(), count: -1 }), (error) => postgresFailure(error, "rate_counter_nonnegative"));
}

/** Each child row names only one cross-case parent, so the named FK is the sole possible refusal. All rows roll back. */
export async function testSameCaseConstraints(db: Database): Promise<void> {
  class Rollback extends Error {}
  await assert.rejects(db.transaction(async (tx) => {
    const [user] = await tx.select({ id: s.users.id }).from(s.users).limit(1);
    assert.ok(user, "seeded_test_user_required");
    const caseFields = { type: "concurrent_review", patientLabel: "Synthetic", service: "Synthetic", levelOfCare: "Synthetic", facility: "Synthetic", payer: "Synthetic", plan: "Synthetic", assignedTo: user.id, status: "imported" as const };
    const [caseA, caseB] = [`FK-A-${randomUUID()}`, `FK-B-${randomUUID()}`];
    await tx.insert(s.cases).values([{ id: caseA, ...caseFields }, { id: caseB, ...caseFields }]);

    const groupRow = (caseId: string) => ({ id: randomUUID(), caseId, status: "complete" as const, asOf: new Date() });
    const runRow = (caseId: string, runGroupId: string, agent = "clinical_documentation") => ({ id: randomUUID(), caseId, runGroupId, agent, agentVersion: "test", model: "none", inputHash: "test", inputDocumentIds: [], status: "succeeded" });
    const packetRow = (caseId: string, version: number, runGroupId: string | null) => ({ id: randomUUID(), caseId, version, content: {}, includedClaimIds: [], contentHash: "test", hashInput: {}, validationReport: {}, runGroupId });
    const documentRow = (caseId: string, supersedesId: string | null) => ({ id: randomUUID(), caseId, type: "progress_note" as const, title: "Synthetic", version: 1, content: "Synthetic", contentHash: randomUUID(), origin: "seed", supersedesId });
    const issueRow = (caseId: string, sourceRunId: string) => ({ id: randomUUID(), caseId, type: "missing_document" as const, severity: "major", blocking: true, status: "open" as const, source: "test", sourceRunId, description: "Synthetic", dedupeKey: randomUUID() });
    const claimRow = (caseId: string, packetVersionId: string, agentRunId: string) => ({ id: randomUUID(), caseId, packetVersionId, sectionHeading: "Synthetic", position: 0, text: "Synthetic", type: enums.CLAIM_TYPES[0], sourceKind: enums.CLAIM_SOURCE_KINDS[0], status: enums.CLAIM_STATUSES[0], author: "test", agentRunId });

    const [groupA, groupB] = [groupRow(caseA), groupRow(caseB)];
    await tx.insert(s.runGroups).values([groupA, groupB]);
    const [runA, runB] = [runRow(caseA, groupA.id), runRow(caseB, groupB.id)];
    await tx.insert(s.agentRuns).values([runA, runB]);
    const [packetA, packetB] = [packetRow(caseA, 1, groupA.id), packetRow(caseB, 1, groupB.id)];
    await tx.insert(s.packetVersions).values([packetA, packetB]);
    const documentA = documentRow(caseA, null);
    await tx.insert(s.documents).values(documentA);

    // Same-case controls prove the fixture rows are otherwise valid.
    await tx.insert(s.issues).values(issueRow(caseA, runA.id));
    await tx.insert(s.claims).values(claimRow(caseA, packetA.id, runA.id));
    await tx.insert(s.documents).values(documentRow(caseA, documentA.id));

    const refused = (constraint: string, write: (nested: Transaction) => Promise<unknown>) =>
      assert.rejects(tx.transaction(write), (error) => postgresFailure(error, constraint, FOREIGN_KEY_VIOLATION), constraint);
    await refused("agent_runs_group_same_case", (nested) => nested.insert(s.agentRuns).values(runRow(caseB, groupA.id, "independent_quality")));
    await refused("issues_source_run_same_case", (nested) => nested.insert(s.issues).values(issueRow(caseB, runA.id)));
    await refused("claims_agent_run_same_case", (nested) => nested.insert(s.claims).values(claimRow(caseB, packetB.id, runA.id)));
    await refused("packets_run_group_same_case", (nested) => nested.insert(s.packetVersions).values(packetRow(caseB, 2, groupA.id)));
    await refused("documents_supersedes_same_case", (nested) => nested.insert(s.documents).values(documentRow(caseB, documentA.id)));
    throw new Rollback();
  }), Rollback);
}

async function main() {
  const url = getEnv().DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("test_database_required");
  const { db, pool } = connectDatabase(url);
  try { await testInvariantChecks(db); await testSameCaseConstraints(db); console.log("Database invariant integration passed."); }
  finally { await pool.end(); }
}
if (process.argv[1]?.endsWith("security-integration.ts")) {
  main().catch(() => { console.error("Database invariant integration failed."); process.exitCode = 1; });
}
