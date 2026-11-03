/**
 * Runs the reference agent on fixture UR-1042 and prints the result.
 *
 *   npx tsx scripts/run-clinical-documentation.ts                 # live call (needs ANTHROPIC_API_KEY; about $0.01 on Haiku)
 *   AGENT_RECORD=1 npx tsx scripts/run-clinical-documentation.ts  # live call, saves output to .agent-replay/
 *   AGENT_REPLAY=1 npx tsx scripts/run-clinical-documentation.ts  # free, reads .agent-replay/
 *   add --late                                                    # include the late Nov 2 note
 *
 * Expected: a high-severity gap for 2026-11-02 without --late, none with it.
 */
import { clinicalDocumentationAgent, computeDateCoverage } from "../lib/agents/clinical-documentation";
import { loadFixture } from "../lib/fixtures/load-fixture";
import { runAgent } from "../lib/harness/run-agent";

async function main() {
  const late = process.argv.includes("--late");
  const { caseJson, documents } = await loadFixture("fixtures/ur-1042", { includeLateArrival: late });

  // This agent reads clinical documents only. Policy and auth records belong to other agents.
  const clinical = documents.filter((d) => ["intake", "treatment_plan", "progress_note"].includes(d.type));

  if (!caseJson.authorization) throw new Error("UR-1042 fixture is missing its authorization block");
  const input = {
    caseId: caseJson.case.id,
    levelOfCare: caseJson.case.level_of_care,
    reviewPeriod: { start: caseJson.authorization.approved_start, end: caseJson.authorization.approved_end },
    asOf: caseJson.case.due_at.slice(0, 10),
    documents: clinical,
  };
  console.log("Date coverage (code):", computeDateCoverage(input));

  const result = await runAgent(clinicalDocumentationAgent, input, {
    recordRun: (r) =>
      console.log(
        `[run] ${r.agent}@${r.version} ${r.model} status=${r.status} attempts=${r.attempts} ` +
          `cost=$${r.costUsd.toFixed(4)}${r.replayed ? " (replay)" : ""}${r.error ? ` error=${r.error}` : ""}`,
      ),
  });

  console.log(JSON.stringify(result.output, null, 2));
  const bad = result.quoteChecks.filter((q) => q.status === "unsupported");
  console.log(`Quotes: ${result.quoteChecks.length - bad.length} verified, ${bad.length} unsupported`);
  for (const q of bad) if (q.status === "unsupported") console.log(`  UNSUPPORTED (${q.reason}) [${q.documentId}] "${q.text}"`);
  if (result.status === "failed") process.exitCode = 1;
}

main();
