import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createHash } from "node:crypto";
import type { AgentDef } from "../agents/types";
import { formatDocuments, type SourceDocument } from "./documents";
import { costUsd, type Usage } from "./pricing";
import { readReplay, replayKey, writeReplay } from "./replay";
import { verifyQuotes, type QuoteCheck } from "./verify-quotes";

/**
 * runAgent(): the ONLY place in the codebase that calls the Claude API.
 * Every agent goes through it. If you need a new capability (streaming,
 * a new model, a new log field), add it here once, not inside an agent.
 *
 * Steps: replay check -> build request -> messages.parse with a Zod schema
 * -> retry once on failure -> verify quotes in code -> cost -> record run.
 */

/** The slice of the Anthropic client we use. Lets tests pass a fake client. */
export interface ClaudeClient {
  messages: {
    parse: (
      params: Anthropic.MessageCreateParamsNonStreaming,
      options?: { timeout?: number; maxRetries?: number },
    ) => PromiseLike<{
      parsed_output: unknown;
      usage: Usage;
      stop_reason: string | null;
    }>;
  };
}

export type RunStatus = "ok" | "needs_review" | "failed";

/** Why a run failed. "timeout" is shown separately in the UI so the clinician sees a timed-out agent, not a generic error. */
export type ErrorKind = "timeout" | "api" | "schema" | "truncated" | "refusal" | "no_replay";

/** One row for the agent_runs table. The caller decides where to store it. */
export interface AgentRunRecord {
  agent: string;
  version: string;
  model: string;
  inputHash: string;
  status: RunStatus;
  attempts: number;
  output: unknown;
  quoteChecks: QuoteCheck[];
  usage: Usage | null;
  costUsd: number;
  replayed: boolean;
  error?: string;
  errorKind?: ErrorKind;
  startedAt: string;
  durationMs: number;
}

export interface AgentResult<O> {
  /** null only when status is "failed". */
  output: O | null;
  /** One entry per quote. "unsupported" quotes must be shown as unsupported in the UI, never hidden. */
  quoteChecks: QuoteCheck[];
  status: RunStatus;
  usage: Usage | null;
  costUsd: number;
  error?: string;
  errorKind?: ErrorKind;
}

export interface RunAgentOptions {
  client?: ClaudeClient;
  model?: string;
  /** Persist the run (db insert in the app, console in scripts). Required by convention; never skip logging. */
  recordRun?: (record: AgentRunRecord) => Promise<void> | void;
  /** Defaults from env: AGENT_REPLAY=1 -> "read", AGENT_RECORD=1 -> "record". */
  replay?: "off" | "read" | "record";
}

/** Every agent input carries the documents its quotes are checked against. */
export interface AgentInput {
  documents: SourceDocument[];
}

let defaultClient: Anthropic | undefined;
function getClient(): ClaudeClient {
  // Server-only. ANTHROPIC_API_KEY is read from env by the SDK; never pass it from the browser.
  defaultClient ??= new Anthropic();
  return defaultClient;
}

function replayMode(): "off" | "read" | "record" {
  if (process.env.AGENT_REPLAY === "1") return "read";
  if (process.env.AGENT_RECORD === "1") return "record";
  return "off";
}

/** Harness-raised errors carry their kind so the UI can say what happened. */
class AgentOutputError extends Error {
  constructor(
    message: string,
    readonly kind: ErrorKind,
  ) {
    super(message);
  }
}

function classifyError(err: unknown): ErrorKind {
  if (err instanceof AgentOutputError) return err.kind;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  return "api";
}

/** 400/401/403/404 will fail the same way again, so do not retry them. */
function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return err.status === undefined || err.status === 408 || err.status === 409 || err.status === 429 || err.status >= 500;
  }
  return true; // schema/parse errors and timeouts: one more try is worth it
}

export async function runAgent<I extends AgentInput, O>(
  agent: AgentDef<I, O>,
  input: I,
  opts: RunAgentOptions = {},
): Promise<AgentResult<O>> {
  const model = opts.model ?? agent.model ?? process.env.MODEL_DEFAULT ?? "claude-haiku-5-5";
  const prompt = agent.buildPrompt(input);
  const mode = opts.replay ?? replayMode();
  const key = replayKey(agent.name, agent.version, model, agent.system, prompt);
  const startedAt = new Date();

  let output: O | null = null;
  let usage: Usage | null = null;
  let attempts = 0;
  let replayed = false;
  let error: string | undefined;
  let errorKind: ErrorKind | undefined;

  if (mode === "read") {
    const saved = await readReplay(key);
    const parsed = agent.output.safeParse(saved);
    if (parsed.success) {
      output = parsed.data;
      replayed = true;
    } else {
      error = `No replay saved for ${key}. Run once with AGENT_RECORD=1 first.`;
      errorKind = "no_replay";
    }
  } else {
    const client = opts.client ?? getClient();
    while (attempts <= agent.maxRetries && output === null) {
      attempts++;
      try {
        const res = await client.messages.parse(
          {
            model,
            max_tokens: agent.maxTokens,
            // System prompt is static per agent version, so cache it.
            system: [{ type: "text", text: agent.system, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: prompt }],
            output_config: { format: zodOutputFormat(agent.output) },
          },
          { timeout: agent.timeoutMs, maxRetries: 0 }, // our loop owns retries
        );
        usage = res.usage;
        if (res.stop_reason === "max_tokens") throw new AgentOutputError(`Hit max_tokens (${agent.maxTokens}); output truncated`, "truncated");
        if (res.stop_reason === "refusal") throw new AgentOutputError("Model refused", "refusal");
        // Validate again ourselves: never trust a shape we did not check.
        const checked = agent.output.safeParse(res.parsed_output);
        if (!checked.success) throw new AgentOutputError(`Output failed schema: ${checked.error.message}`, "schema");
        output = checked.data;
        error = undefined;
        errorKind = undefined;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        errorKind = classifyError(err);
        if (!isRetryable(err)) break;
      }
    }
    if (output !== null && mode === "record") await writeReplay(key, output);
  }

  const quoteChecks = output !== null && agent.extractQuotes ? verifyQuotes(agent.extractQuotes(output), input.documents) : [];
  const status: RunStatus =
    output === null ? "failed" : quoteChecks.some((q) => q.status === "unsupported") ? "needs_review" : "ok";
  const cost = usage ? costUsd(model, usage) : 0;

  await opts.recordRun?.({
    agent: agent.name,
    version: agent.version,
    model,
    inputHash: createHash("sha256").update(prompt).digest("hex"),
    status,
    attempts,
    output,
    quoteChecks,
    usage,
    costUsd: cost,
    replayed,
    error,
    errorKind,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
  });

  return { output, quoteChecks, status, usage, costUsd: cost, error, errorKind };
}

/** Re-exported so agents and scripts import document helpers from one place. */
export { formatDocuments };
export type { SourceDocument };
