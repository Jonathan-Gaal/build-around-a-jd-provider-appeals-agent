import type { z } from "zod";

/**
 * AgentDef: the full definition of one agent. An agent is DATA, not a class:
 * a name, a version, a system prompt, an output schema and a function that
 * builds the user message. The harness (lib/harness/run-agent.ts) does
 * everything else. Do not add methods, tools or network calls here.
 */
export interface AgentDef<Input, Output> {
  /** Stable kebab-case id. Stored on every AgentRun row. */
  name: string;
  /** Bump on ANY change to `system`, `output` or `buildPrompt`. Replay cache and evals key on it. */
  version: string;
  /** Optional per-agent override. Otherwise MODEL_DEFAULT from env. */
  model?: string;
  /** Static text only. No case data, no dates, no ids, so it caches. */
  system: string;
  /** Zod schema the model must answer in. Describe every field with .describe(). */
  output: z.ZodType<Output>;
  /** Builds the user message from typed input. Case documents go here, never in `system`. */
  buildPrompt: (input: Input) => string;
  /** Pulls every quote out of the output so the harness can verify it against sources. */
  extractQuotes?: (output: Output) => { documentId: string; text: string }[];
  maxTokens: number;
  timeoutMs: number;
  /** Retries after the first attempt. Keep at 1. */
  maxRetries: number;
}
