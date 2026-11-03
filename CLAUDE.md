# CLAUDE.md

Instructions for AI coding assistants (Claude Code, Cursor, Copilot and others) working in this repo. Read this before writing code. `AGENTS.md` points here.

## What this project is

A behavioral-health utilization review (UR) workspace. Agents prepare concurrent-review packets and denial responses; a clinician verifies and approves everything. Spec: `docs/product/prd.md`. Start there for any feature question. The target is the PRD's **Example of success** (section 1): every milestone should move UR-1042 and the denial demo toward it, and nothing in it may happen automatically that it says a clinician does.

## Hard rules

1. **Synthetic data only.** Never add real patient data, real names or real identifiers. Fixtures live in `fixtures/` and are marked synthetic.
2. **No agent decides medical necessity, coverage or treatment.** Agents extract, check, match and draft. Never write UI text or prompts that say "medical necessity met/not met."
3. **Nothing is ever sent to a payer.** There is no submission code path in the MVP.
4. **The Anthropic API key is server-only.** Use it only in server code (`lib/`, route handlers, server actions). Never prefix env vars with `NEXT_PUBLIC_`. Never commit `.env*`.
5. **Check authorization on the server in every route handler and server action.** Middleware alone is not enough.
6. **Database access goes through Drizzle.** No string-built SQL.
7. **Agents get no tools.** Every agent is one `runAgent()` call that returns JSON validated by a Zod schema. See `docs/architecture/agent-harness.md`.
8. **Every clinical claim needs a source quote** that the harness verifies in code. Unverified claims are marked unsupported, never silently dropped or kept.
9. **Never silently change dates or facts** to make sources agree. Create an issue instead.
10. **Never pool NY and CA overturn rates.** Label every matched case with its state.

## Stack

Next.js (App Router) + TypeScript (strict), React, Tailwind CSS + shadcn/ui, PostgreSQL + Drizzle, Zod, Auth.js, `@anthropic-ai/sdk`, Vitest, Playwright. Details: `docs/architecture/tech-stack.md`.

Styling: **Tailwind utility classes only.** No SCSS, CSS modules or inline style objects unless this file is updated.

## Layout

```
app/                 routes and screens; app/api/ for route handlers
lib/agents/          one file per agent: system prompt, input type, Zod output schema
                     REFERENCE: lib/agents/clinical-documentation.ts (copy its shape)
lib/harness/         runAgent() (the only Claude API caller), quote verification, replay, cost
lib/fixtures/        load fixtures/<case>/ into SourceDocuments for scripts and evals
lib/orchestrator/    run plans (concurrent review, denial) and rerun logic
lib/db/              Drizzle schema (matches docs/architecture/database-schema.md) and queries
lib/validation/      approval-gate checks
fixtures/            synthetic cases (UR-1042, packets A-E) and the criteria summary
data/                raw and cleaned appeal datasets; don't edit processed files by hand
scripts/             clean data, seed db, run evals
docs/                specs; update them when behavior changes
```

## Conventions

- **Building an agent? Read `docs/architecture/reference-agent.md` first and copy `lib/agents/clinical-documentation.ts`.** Agents are data (`AgentDef`); they never import the SDK, call fetch, read env or touch the db.
- TypeScript strict mode; no `any`. Types for agent outputs come from `z.infer<typeof schema>`.
- Model names come from `process.env.MODEL_DEFAULT` (default `claude-haiku-5-5`) or a per-agent override. Never hard-code a model in a call.
- Prompt changes bump the agent's `version` string.
- Server components by default; add `"use client"` only for interactive pieces.
- Every state change to a case writes an `audit_events` row.
- Tests: unit tests next to the code (`*.test.ts`); end-to-end tests in `e2e/`, named after the PRD acceptance criteria.
- Use replay mode (`AGENT_REPLAY=1`) in tests and local dev to avoid spending API credit.

## Where to look

| Question | Doc |
| --- | --- |
| What should this feature do? | `docs/product/prd.md`, then the story in `docs/product/user-stories.md` |
| Which tables and fields? | `docs/architecture/database-schema.md` |
| What does an agent take and return? | `docs/architecture/agent-specs.md` |
| How do I write an agent? | `docs/architecture/reference-agent.md` |
| Which API routes exist? | `docs/architecture/api.md` |
| What does a screen look like? | `docs/product/wireframes.md` |
| What's next to build? | `docs/plan/build-plan.md` |
| Why was something decided? | `docs/architecture/decisions.md` |

## Commands (once the app exists)

```
npm run dev          # start the app
npm run db:push      # apply Drizzle schema
npm run db:seed      # load fixtures and appeal data
npm test             # unit tests
npm run e2e          # Playwright
npm run eval         # agent evals against answer keys
```
