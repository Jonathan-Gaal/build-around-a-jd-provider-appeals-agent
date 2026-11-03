/**
 * Harness tests use a fake client, so they cost nothing and never touch the network.
 * PATTERN for agent tests: test the deterministic parts (prep, buildPrompt,
 * quote extraction) here; test the model's judgment with evals (scripts/eval.ts).
 */
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { clinicalDocumentationAgent, computeDateCoverage, type ClinicalDocumentationInput } from "../agents/clinical-documentation";
import { runAgent, type AgentRunRecord, type ClaudeClient } from "./run-agent";

const input: ClinicalDocumentationInput = {
  caseId: "UR-TEST",
  levelOfCare: "Inpatient psych",
  reviewPeriod: { start: "2026-11-01", end: "2026-11-03" },
  asOf: "2026-11-03",
  documents: [
    { id: "note-1", type: "progress_note", title: "Day 1", serviceDate: "2026-11-01", version: 1, content: 'Patient states "I still want to die". On close observation.' },
    { id: "note-3", type: "progress_note", title: "Day 3", serviceDate: "2026-11-03", version: 1, content: "Passive suicidal ideation, no plan." },
  ],
};

const usage = { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

function fakeClient(...responses: unknown[]): ClaudeClient & { calls: any[] } {
  const calls: any[] = [];
  const parse = vi.fn(async (params: any) => {
    calls.push(params);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { parsed_output: next, usage, stop_reason: "end_turn" };
  });
  return { messages: { parse }, calls };
}

const goodOutput = {
  facts: [
    { id: "f1", category: "risk", statement: "Patient reported wanting to die.", serviceDate: "2026-11-01", quotes: [{ documentId: "note-1", text: "I still want to die" }] },
  ],
  gaps: [{ item: "No progress note for 2026-11-02", why: "Every day must be documented.", severity: "high" }],
};

describe("computeDateCoverage", () => {
  it("flags the day without a note", () => {
    expect(computeDateCoverage(input)).toEqual([
      { date: "2026-11-01", hasNote: true },
      { date: "2026-11-02", hasNote: false },
      { date: "2026-11-03", hasNote: true },
    ]);
  });
  it("does not flag days after asOf", () => {
    expect(computeDateCoverage({ ...input, asOf: "2026-11-02" }).map((c) => c.date)).toEqual(["2026-11-01", "2026-11-02"]);
  });
});

describe("runAgent", () => {
  it("returns ok when output is valid and quotes verify", async () => {
    const client = fakeClient(goodOutput);
    const records: AgentRunRecord[] = [];
    const res = await runAgent(clinicalDocumentationAgent, input, { client, replay: "off", model: "claude-haiku-5-5", recordRun: (r) => void records.push(r) });
    expect(res.status).toBe("ok");
    expect(res.quoteChecks[0].status).toBe("verified");
    expect(res.costUsd).toBeCloseTo(1000 * 0.1e-6 + 500 * 0.5e-6);
    expect(records).toHaveLength(1);
    // System prompt is cached and documents are in the user message, not the system prompt.
    expect(client.calls[0].system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(client.calls[0].messages[0].content).toContain('<document id="note-1"');
    expect(client.calls[0].messages[0].content).toContain("2026-11-02: NO NOTE");
  });

  it("marks needs_review when a quote is not in the source", async () => {
    const invented = { ...goodOutput, facts: [{ ...goodOutput.facts[0], quotes: [{ documentId: "note-1", text: "patient has a firearm at home" }] }] };
    const res = await runAgent(clinicalDocumentationAgent, input, { client: fakeClient(invented), replay: "off", model: "claude-haiku-5-5" });
    expect(res.status).toBe("needs_review");
    expect(res.quoteChecks[0].status).toBe("unsupported");
  });

  it("retries once after a bad output, then succeeds", async () => {
    const client = fakeClient({ facts: "not an array" }, goodOutput);
    const res = await runAgent(clinicalDocumentationAgent, input, { client, replay: "off", model: "claude-haiku-5-5" });
    expect(client.calls).toHaveLength(2);
    expect(res.status).toBe("ok");
  });

  it("fails visibly after retries run out, never a silent pass", async () => {
    const client = fakeClient(new Error("timeout"), new Error("timeout"));
    const records: AgentRunRecord[] = [];
    const res = await runAgent(clinicalDocumentationAgent, input, { client, replay: "off", model: "claude-haiku-5-5", recordRun: (r) => void records.push(r) });
    expect(res.status).toBe("failed");
    expect(res.output).toBeNull();
    expect(records[0]).toMatchObject({ status: "failed", attempts: 2, error: "timeout", errorKind: "api" });
  });

  it("labels an SDK timeout as errorKind timeout", async () => {
    const timeout = new Anthropic.APIConnectionTimeoutError();
    const client = fakeClient(timeout, timeout);
    const res = await runAgent(clinicalDocumentationAgent, input, { client, replay: "off", model: "claude-haiku-5-5" });
    expect(res.status).toBe("failed");
    expect(res.errorKind).toBe("timeout");
  });
});
