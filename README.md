# Behavioral-health UR workspace and appeals agent

A prototype workspace for utilization review (UR) clinicians at behavioral-health providers. Specialized Claude agents assemble a concurrent-review packet with a source quote behind every statement, flag missing or conflicting information, predict the insurer's objections, and, when a denial comes in, match it to 3,680 real external appeal decisions from New York and California and draft the response. A clinician reviews and approves everything. Nothing is sent to a payer.

Built by Jonathan Gaal and Umer Bashir for the L-2 Week 6 "build around a job description" project, around Ritten's [Authorization (UR) Specialist](https://www.ritten.io/jobs/authorization-ur-specialist) role.

> **Synthetic data only.** No real patient information is used anywhere in this project.

## What success looks like

In fictional case UR-1042, a UR clinician opens a prepared concurrent-review packet. The workspace has already flagged the missing November 2 note and the gap between the requested dates (Nov 4–6) and the authorized dates (Nov 1–3). The clinician verifies each claim against its source, reviews the plan's three likely objections, resolves both issues and approves that exact packet version. When a denial comes in, the clinician sees the parsed reason and deadline, similar real NY or CA appeal decisions and a recommended next step, then approves a drafted appeal through the same checks. No clinical determination and no payer submission ever happen automatically. (From [PRD §1](docs/product/prd.md#example-of-success).)

**Failure** would be a polished packet that quotes a note that doesn't exist, quietly changes the requested dates, says "meets medical necessity", and still lets the clinician approve. Every guard in the build (quote verification, the approval gate, no silent date changes, the clinical boundary) exists to prevent that. See [PRD §1](docs/product/prd.md#example-of-failure).

## Status

Design complete. The reference agent and harness are in `lib/` (see [reference agent](docs/architecture/reference-agent.md)); the app scaffold is next. See the [build plan](docs/plan/build-plan.md).

## Docs

- [PRD](docs/product/prd.md): what we're building
- [User stories](docs/product/user-stories.md) and [JD coverage](docs/research/job-descriptions.md#jd-coverage-what-the-app-does-for-each-duty)
- [Docs index](docs/README.md): user flow, agents, harness, tech stack, data and decisions
- [CLAUDE.md](CLAUDE.md): rules for AI coding assistants

## Repo layout

```
app/  lib/  fixtures/  e2e/     (coming with the build)
data/        raw and cleaned NY/CA appeal datasets
scripts/     data cleaning (and later seed and eval scripts)
docs/        product, architecture, data, research and plan docs
```

## Running it

For local synthetic development, configure the deployment, database, origin, auth secret and per-account credentials listed in `.env.example`. See [role accounts and permissions](docs/product/role-logins.md) for workspace access and tests.

```
cp .env.example .env.local     # configure local values; never commit credentials
npm install
npm run db:push && npm run db:seed
npm run dev
```

## Data

`data/processed/` holds 1,526 NY and 2,154 CA behavioral-health external appeal decisions, cleaned by `scripts/clean_appeals_data.py` from public sources. See [data/README.md](data/README.md).
