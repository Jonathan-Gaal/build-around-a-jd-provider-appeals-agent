# Behavioral-health UR workspace and appeals agent

A prototype workspace for utilization review (UR) clinicians at behavioral-health providers. Specialized Claude agents assemble a concurrent-review packet with a source quote behind every statement, flag missing or conflicting information, predict the insurer's objections, and, when a denial comes in, match it to 3,680 real external appeal decisions from New York and California and draft the response. A clinician reviews and approves everything. Nothing is sent to a payer.

Built by Jonathan Gaal and Umer Bashir for the L-2 Week 6 "build around a job description" project, around Ritten's **Authorization (UR) Specialist** role. Ritten makes an EHR and practice-management system for behavioral-health providers; the role sits on its Revenue Cycle Management team.

**The role.** The specialist gets and maintains prior authorizations and concurrent reviews across behavioral-health levels of care, payers and states. They are the first line of defense against authorization-related denials and coordinate with the intake, clinical and billing teams.

**Responsibilities**

1. Get and submit initial authorizations for IOP, PHP, residential and detox, with medical-necessity documentation (ASAM criteria).
2. Manage concurrent reviews and track expiration dates to prevent coverage gaps.
3. Keep authorization records accurate, monitor unit limits and handle retro-authorization requests.
4. Be the main contact with payer UR departments, including peer-to-peer reviews and appeals.
5. Find authorization gaps, support denial appeals and report denial trends to leadership.
6. Coordinate with the intake, clinical and billing teams so documentation is complete and claims are clean.

**Qualifications**

- At least 3 years of behavioral-health UR or prior-authorization experience, across multiple levels of care.
- Commercial, Medicaid and Medicare payers across states; ASAM; concurrent reviews, retro-auths and appeals.
- Preferred: multi-state Medicaid, peer-to-peer preparation, ICD-10 codes and how they relate to level of care, CBHCM.

*Summarized in our words. The original posting is at [ritten.io/jobs/authorization-ur-specialist](https://www.ritten.io/jobs/authorization-ur-specialist) and may change or disappear.*

> **Synthetic data only.** No real patient information is used anywhere in this project.

## What success looks like

In fictional case UR-1042, a UR clinician opens a prepared concurrent-review packet. The workspace has already flagged the missing November 2 note and the gap between the requested dates (Nov 4–6) and the authorized dates (Nov 1–3). The clinician verifies each claim against its source, reviews the plan's three likely objections, resolves both issues and approves that exact packet version. When a denial comes in, the clinician sees the parsed reason and deadline, similar real NY or CA appeal decisions and a recommended next step, then approves a drafted appeal through the same checks. No clinical determination and no payer submission ever happen automatically. (From [PRD §1](docs/product/prd.md#example-of-success).)

**Failure** would be a polished packet that quotes a note that doesn't exist, quietly changes the requested dates, says "meets medical necessity", and still lets the clinician approve. Every guard in the build (quote verification, the approval gate, no silent date changes, the clinical boundary) exists to prevent that. See [PRD §1](docs/product/prd.md#example-of-failure).

## Status

Working prototype with demo mode: self-playing role walkthroughs use bundled recordings and synthetic data. Appeal matching is planned. The hosted deployment needs configuration before it can run. See [BACKEND.md](BACKEND.md) for setup and [TODO.md](TODO.md) for the backend handoff and remaining work.

## Docs

- [PRD](docs/product/prd.md): what we're building
- [User stories](docs/product/user-stories.md) and [JD coverage](docs/research/job-descriptions.md#jd-coverage-what-the-app-does-for-each-duty)
- [Docs index](docs/README.md): user flow, agents, harness, tech stack, data and decisions
- [CLAUDE.md](CLAUDE.md): rules for AI coding assistants

## Repo layout

```
app/  components/  lib/  fixtures/  e2e/  migrations/
data/        raw and cleaned NY/CA appeal datasets
scripts/     data cleaning, seed and eval scripts
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
