# Reference agent: how to build an agent here

Written for AI coding assistants (Claude Code, Cursor, Copilot) building this repo. The Clinical Documentation agent is the working example. Every other agent copies its shape. When this doc and the code disagree, the code wins; fix the doc.

## Files

| File | Role | Change it when |
| --- | --- | --- |
| `lib/agents/clinical-documentation.ts` | **The reference agent.** Input type, Zod output, deterministic prep, system prompt, `buildPrompt`, `extractQuotes`, `AgentDef` | Never as a template; copy it |
| `lib/agents/types.ts` | `AgentDef<Input, Output>` interface | Rarely; changes affect every agent |
| `lib/agents/shared.ts` | `SHARED_RULES` (start of every system prompt), shared `Quote` and `Gap` schemas | Rarely; bump every agent's version |
| `lib/harness/run-agent.ts` | `runAgent()`: the **only** code that calls the Claude API. Replay, cached system prompt, `messages.parse` with `zodOutputFormat`, one retry, re-validation, quote verification, cost, run record | New cross-cutting capability |
| `lib/harness/documents.ts` | `SourceDocument` type and `formatDocuments()` (wraps each in `<document id=...>`) | New document type |
| `lib/harness/verify-quotes.ts` | Checks each quote exists verbatim in its document; returns offsets for highlighting | Rarely |
| `lib/harness/pricing.ts` | Price per model, `costUsd()` | Pricing or models change |
| `lib/harness/replay.ts` | `.agent-replay/` cache keyed by agent, version, model and prompt | Rarely |
| `lib/fixtures/load-fixture.ts` | Loads `fixtures/<case>/` into `SourceDocument[]`; skips answer keys | New fixture format |
| `lib/harness/*.test.ts` | Vitest with a fake client: no network, no cost | Every harness or agent change |
| `scripts/run-clinical-documentation.ts` | Runs the agent on UR-1042 from the command line | Copy for each new agent |

## Data flow

```
orchestrator (plain TS)
  └─ runAgent(agentDef, input, { recordRun })
       ├─ agentDef.buildPrompt(input)          → user message (case data + <document> blocks)
       ├─ messages.parse({ system: cached, output_config: zodOutputFormat(agentDef.output) })
       ├─ agentDef.output.safeParse(...)        → retry once if invalid
       ├─ verifyQuotes(agentDef.extractQuotes(output), input.documents)
       ├─ status: ok | needs_review (some quote unsupported) | failed
       └─ recordRun(AgentRunRecord)            → agent_runs row in the app; console in scripts
```

## Checklist: adding a new agent

1. Copy `lib/agents/clinical-documentation.ts` to `lib/agents/<name>.ts`. Keep the 7 numbered sections in the same order.
2. **Input:** a typed interface that includes `documents: SourceDocument[]` and `asOf` if anything depends on today. Never read the clock, env, database or files inside an agent.
3. **Output:** a Zod object. `.describe()` every field. Use `Quote` from `shared.ts` for any clinical or administrative claim. Use enums, not free text, wherever the UI branches on a value.
4. **Deterministic prep:** if code can compute it (dates, overlaps, counts, deadlines, lookups, SQL prefilter), compute it in an exported function, put the result in the prompt as "computed by code, authoritative", and unit-test the function. The model explains; it does not count.
5. **System prompt:** start with `SHARED_RULES`, then "Your job: ...", what to look for, how to work. Static text only; no case data, ids or dates. This keeps it cacheable.
6. **buildPrompt:** case fields first, then the computed context, then `formatDocuments(input.documents)`. Pass only the documents this agent needs.
7. **extractQuotes:** return every quote in the output. If the agent cites nothing (e.g. Authorization Tracking, which is mostly code), omit it.
8. **Version:** start at `1.0.0`. Bump it on any change to `system`, `output` or `buildPrompt`; replay and evals depend on it.
9. **Tests:** add `lib/agents/<name>.test.ts` for the prep functions and for `buildPrompt` (it must contain the documents and computed context). Use the fake client from `run-agent.test.ts` for one end-to-end harness test.
10. **Script:** copy `scripts/run-clinical-documentation.ts`. Record one live run with `AGENT_RECORD=1` so the UI and tests can use replay.
11. **Spec:** update the agent's row in `docs/architecture/agent-specs.md` with the final input and output.

## Hard rules (also in CLAUDE.md)

- Agents never import `@anthropic-ai/sdk`, call `fetch`, use tools, read env vars or touch the database. Only `runAgent()` calls the API.
- Never drop or hide a `needs_review` or `failed` result. The UI shows unsupported quotes as unsupported and failed agents as incomplete.
- Never state or decide medical necessity. Agents organize evidence; clinicians decide.
- No real patient data. Fixtures only.
- The API key is server-only. `runAgent()` runs in route handlers, server actions or scripts, never in a client component.

## Running it

Dependencies (added in the M0 scaffold): `@anthropic-ai/sdk`, `zod`, `vitest`, `tsx`, `typescript`.

```bash
npx vitest run lib                                             # tests, free
ANTHROPIC_API_KEY=... AGENT_RECORD=1 npx tsx scripts/run-clinical-documentation.ts   # one live run, about $0.01 on Haiku, saved
AGENT_REPLAY=1 npx tsx scripts/run-clinical-documentation.ts   # free rerun from .agent-replay/
AGENT_REPLAY=1 npx tsx scripts/run-clinical-documentation.ts --late   # with the late Nov 2 note (record it first)
```

`MODEL_DEFAULT` selects the model (`claude-haiku-5-5` while building). Expected result on UR-1042: risk, symptom and functioning facts with verified quotes, and a high-severity gap for the missing 2026-11-02 note, which disappears with `--late`.
