# Behavioral-health UR workspace and appeals agent

A prototype workspace for utilization review (UR) clinicians at behavioral-health providers. Specialized Claude agents assemble a concurrent-review packet with a source quote behind every statement, flag missing or conflicting information, predict the insurer's objections, and, when a denial comes in, match it to 3,680 real external appeal decisions from New York and California and draft the response. A clinician reviews and approves everything. Nothing is sent to a payer.

Built by Jonathan Gaal and Umer Bashir for the L-2 Week 6 "build around a job description" project, around Ritten's [Authorization (UR) Specialist](https://www.ritten.io/jobs/authorization-ur-specialist) role.

> **Synthetic data only.** No real patient information is used anywhere in this project.

## Status

Design complete; build starting. See the [build plan](docs/plan/build-plan.md).

## Docs

- [PRD](docs/product/prd.md): what we're building
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

Not runnable yet. Once the app is scaffolded:

```
cp .env.example .env.local     # add ANTHROPIC_API_KEY and DATABASE_URL
npm install
npm run db:push && npm run db:seed
npm run dev
```

## Data

`data/processed/` holds 1,526 NY and 2,154 CA behavioral-health external appeal decisions, cleaned by `scripts/clean_appeals_data.py` from public sources. See [data/README.md](data/README.md).
