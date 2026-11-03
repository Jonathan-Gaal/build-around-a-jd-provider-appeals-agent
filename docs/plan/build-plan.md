# Build plan

Milestones come from the [PRD](../product/prd.md). Each task is sized to be one GitHub issue.

- **Track A, backend (Jonathan):** database, auth, API routes and server actions, data seeding, harness, agents, orchestrator, approval logic, evals.
- **Track B, frontend (Umer, to confirm):** app scaffold, layout, screens, components, progress UI, Playwright tests.

The tracks meet at three contracts, so agree on them first: the [database schema](../architecture/database-schema.md), the [API](../architecture/api.md) (routes and response shapes), and the [agent output schemas](../architecture/agent-specs.md). Until an endpoint exists, frontend builds against the fixture JSON or `AGENT_REPLAY=1` outputs with the same shape.

## M0. Agreements (half a day, together)

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| 0.1 | Confirm the MVP scope: concurrent review + denial | Both | Decision recorded in `docs/architecture/decisions.md` |
| 0.2 | Review [database-schema.md](../architecture/database-schema.md) | Both | No open comments |
| 0.3 | Review [agent-specs.md](../architecture/agent-specs.md) output schemas | Both | No open comments |
| 0.4 | Pick the demo model and the presentation date | Both | Written in the PRD's open questions |
| 0.5 | Create GitHub issues from this plan and assign them | Both | Issues exist with owners |

## M1. Foundation

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| 1.1 | Scaffold Next.js + TypeScript + Tailwind + shadcn/ui | B | `npm run dev` shows a page. Create it in a temp folder and merge in (the repo isn't empty); keep `lib/` as is and add `@anthropic-ai/sdk`, `zod`, `vitest`, `tsx` so `npx vitest run lib` passes |
| 1.2 | Postgres (local Docker + hosted) and Drizzle schema from the schema doc | A | `npm run db:push` works |
| 1.3 | Auth.js with demo users: clinician, coordinator, supervisor, plus a server-side case access check | A | Sign-in works; role is on the session |
| 1.4 | Seed script: load `data/processed/*.csv` into `appeal_cases` | A | 3,680 rows; counts match `data/README.md` |
| 1.5 | Seed script: load `fixtures/` cases and documents | A | UR-1042 and packets A to E appear in the DB |
| 1.6 | Audit event helper used by every write | A | Unit test passes |
| 1.7 | `.env.example`, `.gitignore` covers `.env*` | A | Key never committed |

## M2. Evidence workspace

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| 2.1 | Queue screen | B | Cases sorted by deadline with status and issue count |
| 2.2 | Case layout: three panes and header | B | Matches wireframe |
| 2.3 | Document viewer with highlighted character ranges | B | Clicking a claim scrolls to and highlights its passage |
| 2.4 | Summary screen (static data first) | B | Shows requested vs authorized periods separately |
| 2.5 | Evidence screen: claim-to-source map | B | Every claim opens its passage |

## M3. Harness, agents and issues

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| 3.1 | `runAgent()` with Zod parsing, retry, AgentRun records, cost tracking | A | Unit tests with a mocked client pass. **Code in `lib/harness/`; wire `recordRun` to the `agent_runs` table** |
| 3.2 | Quote verifier: quote → character offsets, or "unsupported" | A | Unit tests incl. whitespace and near-miss cases. **Done (`lib/harness/verify-quotes.ts`)** |
| 3.3 | Replay mode keyed by agent version + input hash | A | Second run makes no API call. **Code done; needs one recorded live run** |
| 3.4 | Clinical Documentation agent | A | Finds the missing Nov 2 note on UR-1042. **Code done; needs first live run** |
| 3.5 | Payer Policy agent + criteria summary fixture | A | Each dimension marked with a quote |
| 3.6 | Authorization Tracking (code + letter parser) | A | Flags the UR-1042 date conflict without changing dates |
| 3.7 | Case Assembly and Drafting (packet mode) | A | Draft claims all carry evidence spans |
| 3.8 | Insurer Reviewer | A | Returns 3 objections tied to evidence or gaps |
| 3.9 | Independent Quality | A | Flags an injected unsupported claim |
| 3.10 | Orchestrator run plans + targeted reruns | A | Changing one date reruns only Assembly and Quality |
| 3.10b | Run budget and partial failure: skip dependents of a failed agent, stop at the budget, "Retry failed agents" | A | Partial failure acceptance criterion passes with a forced timeout |
| 3.11 | Run status endpoint (A) + progress UI (B) | A, B | Each agent lights up as it finishes; failed, timed-out and skipped agents show with the reason |
| 3.12 | Issue resolution server actions (A) + Issues screen (B) | A, B | Missing note can't be closed by a checkbox |

## M4. Approval

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| 4.1 | Packet versions with content hash | A | Hash changes when any claim changes |
| 4.2 | Validation checks and approval gate | A | Gate lists exact blockers |
| 4.3 | Approval screen | B | Approve disabled with reasons; enabled once clear |
| 4.4 | Invalidate approval on material change | A | E2E test passes |
| 4.5 | Playwright tests for the PRD's acceptance criteria | B | All concurrent-review criteria pass |

## M5. Denials

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| 5.1 | Denial upload and letter parsing | A | Reason, dates and deadline extracted |
| 5.2 | Case Match prefilter (SQL) + agent, with holdout | A | Packet's own source case never appears |
| 5.3 | Next-step recommendation with per-state overturn rate | A | Label reads "overturn rate at external review" |
| 5.4 | Drafting in appeal / peer-to-peer mode + Insurer Reviewer fix round | A | Draft passes Quality |
| 5.5 | Denial upload route (A) + Denial screen (B) | A, B | Matched cases labeled by state with reasons |
| 5.6 | `payer_letters`, `appeals`, `submissions` tables + case status transitions | A | Unit tests cover approval, partial approval, request for info, denial, upheld and overturned |
| 5.7 | Letter parser (all letter kinds) + eval against `expected-fields.json` | A | All UR-1042 responses and packet appeal decisions match on dates and enums |
| 5.8 | Appeal chain view on the case (B) and verify-letter flow (A) | A, B | Appeal tracking acceptance criterion passes |

## M6. Evaluation and demo

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| 6.1 | `scripts/eval.ts` against answer keys + single-agent baseline | A | Metrics table generated |
| 6.2 | Switch to the demo model; record cost and time | A | Under $1 and 2 minutes per run |
| 6.3 | Demo script rehearsal (both scenes) | Both | Two clean run-throughs that match the PRD's Example of success step for step |
| 6.4 | Slides: problem, demo, results, limits | Both | Deck done |

## Cut list if time runs short

Cut in this order: denial trends (FR-22), procedural appeal checks (FR-21), freshness indicators (FR-19), escalation tasks (FR-20), the single-agent baseline, then the peer-to-peer draft mode. Never cut quote verification or the approval gate.
