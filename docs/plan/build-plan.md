# Build plan

Milestones come from the [PRD](../product/prd.md). Each task is sized to be one GitHub issue. Owners are a **suggested split**; change them to match who you are.

- **Track A (suggested: Jonathan):** data, fixtures, harness, agents, evals.
- **Track B (suggested: Umer):** app scaffold, database, auth, screens, tests.

Both tracks meet at the database schema and the agent output schemas, so agree on those two docs first.

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
| 1.1 | Scaffold Next.js + TypeScript + Tailwind + shadcn/ui | B | `npm run dev` shows a page |
| 1.2 | Postgres (local Docker + hosted) and Drizzle schema from the schema doc | B | `npm run db:push` works |
| 1.3 | Auth.js with demo users: clinician, coordinator, supervisor | B | Sign-in works; role is on the session |
| 1.4 | Seed script: load `data/processed/*.csv` into `appeal_cases` | A | 3,680 rows; counts match `data/README.md` |
| 1.5 | Seed script: load `fixtures/` cases and documents | A | UR-1042 and packets A to E appear in the DB |
| 1.6 | Audit event helper used by every write | B | Unit test passes |
| 1.7 | `.env.example`, `.gitignore` covers `.env*` | B | Key never committed |

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
| 3.1 | `runAgent()` with Zod parsing, retry, AgentRun records, cost tracking | A | Unit tests with a mocked client pass |
| 3.2 | Quote verifier: quote → character offsets, or "unsupported" | A | Unit tests incl. whitespace and near-miss cases |
| 3.3 | Replay mode keyed by agent version + input hash | A | Second run makes no API call |
| 3.4 | Clinical Documentation agent | A | Finds the missing Nov 2 note on UR-1042 |
| 3.5 | Payer Policy agent + criteria summary fixture | A | Each dimension marked with a quote |
| 3.6 | Authorization Tracking (code + letter parser) | A | Flags the UR-1042 date conflict without changing dates |
| 3.7 | Case Assembly and Drafting (packet mode) | A | Draft claims all carry evidence spans |
| 3.8 | Insurer Reviewer | A | Returns 3 objections tied to evidence or gaps |
| 3.9 | Independent Quality | A | Flags an injected unsupported claim |
| 3.10 | Orchestrator run plans + targeted reruns | A | Changing one date reruns only Assembly and Quality |
| 3.11 | Run status endpoint + progress UI | B | Each agent lights up as it finishes |
| 3.12 | Issues screen with typed resolutions | B | Missing note can't be closed by a checkbox |

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
| 5.5 | Denial screen | B | Matched cases labeled by state with reasons |

## M6. Evaluation and demo

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| 6.1 | `scripts/eval.ts` against answer keys + single-agent baseline | A | Metrics table generated |
| 6.2 | Switch to the demo model; record cost and time | A | Under $1 and 2 minutes per run |
| 6.3 | Demo script rehearsal (both scenes) | Both | Two clean run-throughs that match the PRD's Example of success step for step |
| 6.4 | Slides: problem, demo, results, limits | Both | Deck done |

## Cut list if time runs short

Cut in this order: denial trends (FR-22), procedural appeal checks (FR-21), freshness indicators (FR-19), escalation tasks (FR-20), the single-agent baseline, then the peer-to-peer draft mode. Never cut quote verification or the approval gate.
