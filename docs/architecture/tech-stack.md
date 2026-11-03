# Tech stack

One TypeScript codebase: a Next.js app whose server side runs the orchestrator and agents. This is our recommendation; anything marked "pick one" is still open.

| Layer | Choice | Why |
| --- | --- | --- |
| App framework | Next.js (App Router) + TypeScript | UI and server in one project. Agents run in server code only, so the API key never reaches the browser |
| UI | React, Tailwind CSS, shadcn/ui | Fast to build the queue, three-pane workspace, issue cards and tables |
| Document viewer | Synthetic documents stored as text/Markdown, rendered with highlighted spans | Passage-level citations are simple character offsets; no PDF parsing needed |
| Database | PostgreSQL (Neon or Supabase hosted; Docker locally) | Relational case data, plus built-in full-text search for the Case Match prefilter |
| ORM | Drizzle (or Prisma, pick one) | Typed, parameterized queries. No string-built SQL |
| Validation | Zod | One schema for each agent's output, API inputs and forms |
| LLM | Claude API via `@anthropic-ai/sdk` | Structured outputs with Zod, prompt caching. See [agent harness](agent-harness.md) |
| Auth | Auth.js with demo accounts and roles (clinician, coordinator, supervisor) | Enough for role- and case-based checks in the prototype |
| Testing | Vitest (unit), Playwright (end-to-end), an eval script for agents | The acceptance criteria in the [PRD](../product/prd.md) map to Playwright tests |
| Hosting | Vercel + hosted Postgres | Free tiers cover a class demo |

## Where things live

```
app/                    Next.js routes and screens (queue, case workspace, approval)
  api/                  Route handlers: start a run, run status, approve, upload
lib/
  agents/               One file per agent: prompt, input and output schemas (see agent-harness.md)
  harness/              runAgent(), citation checks, record/replay, cost tracking
  orchestrator/         Run plans for concurrent review and denial, rerun logic
  db/                   Drizzle schema and queries
  validation/           Approval-gate checks
data/                   Raw and cleaned appeal datasets (already here)
fixtures/               Synthetic cases: UR-1042 and denial packets A to E
scripts/                Data cleaning, database seed, evals
docs/                   This documentation
```

## Setup steps (when we start building)

1. `npx create-next-app` with TypeScript, Tailwind and the App Router.
2. Add Postgres, Drizzle and a seed script that loads `data/processed/*.csv` into an `appeal_cases` table and `fixtures/` into case tables.
3. Add `@anthropic-ai/sdk` and `zod`. Put `ANTHROPIC_API_KEY` in `.env.local`, which `.gitignore` must exclude.
4. Build the harness and one agent end to end before adding the rest.

Security rules for this stack are in [security.md](security.md).
