import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

const expected = ["success", "clinical_api", "assembly_api", "quality_api", "clinical_schema", "assembly_schema", "quality_schema", "clinical_timeout", "assembly_timeout", "quality_timeout", "clinical_recover", "assembly_recover", "quality_recover", "unsupported_quote", "unknown_fact", "duplicate_fact", "quality_finding", "stale_inputs"];
const schema = z.object({ scenario: z.string(), passed: z.literal(true), liveModelCalls: z.literal(0), groupStatus: z.string(), counts: z.object({ clinical: z.number(), assembly: z.number(), quality: z.number() }), handoffs: z.array(z.string()), approvalBlocked: z.boolean(), originalSourcesUnchanged: z.literal(true) });
async function main() {
const reports = [];
for (const name of expected) {
  const report = schema.parse(JSON.parse(await readFile(`.e2e-results/agent-loop/${name}.json`, "utf8")));
  assert.equal(report.scenario, name);
  for (const agent of ["assembly", "quality"] as const) assert.equal(report.handoffs.filter(handoff => handoff === agent).length, report.counts[agent], `${name}: every invoked downstream agent must pass independent handoff assertions`);
  assert.equal(report.approvalBlocked, name !== "success" && !name.endsWith("_recover"));
  reports.push(report);
}
const summary = { passed: true, scenarios: reports.length, liveModelCalls: 0, originalSourcesUnchanged: true, handoffsVerified: true, reports };
await writeFile(".e2e-results/agent-loop/summary.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, reports: undefined }, null, 2));
}
void main();
