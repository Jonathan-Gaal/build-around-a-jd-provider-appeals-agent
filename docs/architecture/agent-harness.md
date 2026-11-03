# Agent harness

The harness is the code wrapped around every LLM call. It builds the prompt, calls Claude, checks the answer, retries on failure, records the run and tracks cost. The orchestrator decides *which* agents run; the harness decides *how* each one runs.

## Recommendation: a thin custom harness on the Anthropic TypeScript SDK

| Option | Fit | Why |
| --- | --- | --- |
| **Custom harness on `@anthropic-ai/sdk`** | **Use this** | Our flow is fixed and each agent is one call that returns JSON. About 200 lines of our own code gives full control over validation, citations, cost and audit records |
| Claude Agent SDK | Not needed | Built for autonomous agents that use tools, files and shells in a loop. Our agents shouldn't take actions |
| Claude Managed Agents | Not needed | Anthropic hosts the agent loop and a sandbox. Useful for long-running agents; ours are single calls, and keeping everything in our app is simpler to audit |
| LangChain / LangGraph | Not needed | Adds abstraction we'd have to learn and debug, for a flow that's a few `await`s |
| Vercel AI SDK | Optional | Fine if we want its UI streaming helpers, but the Anthropic SDK alone covers what we need |

None of our agents gets tools. They read what we pass in and return JSON. That keeps them from taking any action, which matters for prompt injection and for "agents never submit."

## What an agent looks like

Each agent is a definition object. Same shape for all seven.

```ts
// lib/agents/types.ts
import { z } from "zod";

export interface AgentDef<I, O extends z.ZodTypeAny> {
  name: string;              // "clinical-documentation"
  version: string;           // bump when the prompt changes; stored on every run
  model?: string;            // override; defaults to MODEL_DEFAULT
  system: string;            // stable instructions (cached)
  output: O;                 // Zod schema the answer must match
  buildPrompt(input: I): string;
  timeoutMs: number;
  maxRetries: number;        // usually 1
}
```

## What `runAgent()` does

1. **Hash the inputs.** If replay mode is on and a saved output exists for this agent version and input hash, return it without calling the API.
2. **Build the request.** The stable system prompt (and the criteria summary, where used) go first with `cache_control` so repeat runs are cheap. Case documents go in the user message, wrapped in tags marked as untrusted data.
3. **Call Claude with structured output.**

   ```ts
   const res = await client.messages.parse({
     model: def.model ?? process.env.MODEL_DEFAULT,   // "claude-haiku-5-5" while building
     max_tokens: 8000,
     system: [{ type: "text", text: def.system, cache_control: { type: "ephemeral" } }],
     messages: [{ role: "user", content: def.buildPrompt(input) }],
     output_config: { format: zodOutputFormat(def.output) },
   });
   const out = res.parsed_output; // null if parsing failed
   ```

4. **Validate.** If the output is null or fails the schema, retry once, then mark the run failed. A failed run shows as "incomplete" in the UI, never as a pass.
5. **Check citations in code.** Every quote an agent cites must appear word for word in the source document it names. Code checks this with a string match and stores the character offsets. A quote that doesn't match marks the claim "unsupported." This is the strongest guard against invented facts, and it costs nothing.
6. **Record the run.** Save an `AgentRun` row: agent, version, model, input hash and document versions, output, citations, token usage from `res.usage`, cost, time, status and errors.
7. **Save for replay** during development.

## Orchestrator on top

- A **run plan** per case type lists agents and their dependencies. Independent agents run together with `Promise.all`.
- **Targeted reruns:** when a document or field changes, rerun only agents whose input hash changed, then Assembly and Quality.
- **Bounded rework:** the Insurer Reviewer gets one fix round with the drafter; anything still open becomes an issue for a person.
- The UI polls run status (or listens over server-sent events) and shows each agent's progress.
- **Timeouts:** each call has a 60-second timeout (`timeoutMs` on the agent) and one retry. SDK retries are off (`maxRetries: 0`), so the harness owns the count. A timeout returns `errorKind: "timeout"`.
- **Run budget:** the orchestrator counts calls and tokens per run group (12 calls, 200,000 tokens). It checks before starting each agent and stops at the limit, marking the group `budget_exceeded`.
- **Retry limits (no runaway calls):** at most 2 attempts per call (1 retry, SDK retries off); at most 2 manual "Retry failed agents" per agent per run group, then it becomes an issue for a person; reruns only when an agent's input hash changed; one Insurer Reviewer fix round. Agents have no tools, so they can't trigger calls. Set a $40 monthly spend limit on the Anthropic workspace as the last backstop.
- **States:** agent runs are queued, running, succeeded, needs_review (an unsupported quote), failed, timed_out or skipped. Run groups are running, complete, partial, failed or budget_exceeded. Every attempt, error, token count and cost goes on the `agent_runs` row.
- **Partial failure:** if an agent fails or times out, agents that depend on it are marked `skipped` rather than run on partial input. Agents that don't depend on it still run. The group ends `partial`, approval stays blocked, and "Retry failed agents" reruns only the failed agent and its dependents.

## Models and cost

- `MODEL_DEFAULT=claude-haiku-5-5` while building. Switch to `claude-sonnet-5-5` or `claude-opus-5-5` for final tests and the demo by changing that one value.
- Per-agent overrides are allowed, for example a stronger model only for Drafting and the Insurer Reviewer.
- Track cost per run from `res.usage` and show a running total so we see the $40 draining. See [budget](budget.md).

## Evals

`scripts/eval.ts` runs every synthetic case and compares results to the answer keys: the recommendation, whether the Insurer Reviewer hit the real reviewer's reason, whether planted gaps were caught, and the citation support rate. It can also run a **single-agent baseline** (one big prompt doing everything) on the same inputs, which is how the PRD's metrics compare specialized agents against one model doing it all. Run evals on Haiku with replay on to keep them cheap.
