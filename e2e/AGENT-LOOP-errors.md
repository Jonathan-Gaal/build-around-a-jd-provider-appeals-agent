# UR-1042 agent loop error tests

These tests execute the existing API, orchestrator, agent harness, acceptance layer, approval gates and PostgreSQL persistence. Only model responses and transport failures are simulated. No production backend modules or prompts are changed. No real patient data, paid model calls, clinical determinations or payer submissions are involved.

## Run

For each scenario, create a **fresh local PostgreSQL database ending `_test`**, supply its `DATABASE_URL` to the process, then run:

```text
npm run db:migrate
npm run test:agent-loop -- <scenario>
```

Use the existing local configuration with `APP_DEPLOYMENT=local` and the synthetic demo clock. The script refuses nonlocal databases and databases containing cases. It does not change rate limits or erase existing data. Use separate databases for each scenario; each test uses the existing upload/verification API to prepare a valid baseline, resolve both issues and capture a real approval before injecting a fault into the next run.

After all scenarios:

```text
npm run test:agent-loop:verify
```

Per-scenario results and the aggregate report are stored locally under `.e2e-results/agent-loop/` and excluded from Git. Configuration and API credentials are never included in reports.

## Acceptance matrix

| Scenarios | Assertions |
| --- | --- |
| `success` | All three agents succeed; unchanged output reuses the packet and preserves its exact-version approval |
| `clinical_api`, `assembly_api`, `quality_api` | Each agent's API failure retries once; earlier successful results remain; later agents skip; old packet survives; approval is refused |
| `clinical_schema`, `assembly_schema`, `quality_schema` | Invalid output is rejected after two attempts, classified as a schema error, and cannot progress to sign-off |
| `clinical_timeout`, `assembly_timeout`, `quality_timeout` | Injected SDK timeout is stored as `timed_out` with error kind `timeout`; retry limit, dependency skipping and sign-off blocking hold |
| `clinical_recover`, `assembly_recover`, `quality_recover` | First attempt fails, second succeeds; downstream handoffs work and unchanged output preserves approval |
| `unsupported_quote` | Invented quotation is marked unsupported; a subsequent model pass cannot override the code failure |
| `unknown_fact` | Draft reference to a nonexistent fact produces an unsupported claim and blocks sign-off |
| `duplicate_fact` | Duplicate fact IDs fail Clinical Documentation with a schema error; both downstream agents skip |
| `quality_finding` | A valid Quality response reporting a failed check blocks approval even though agent execution completes |
| `stale_inputs` | A new immutable source arriving during Quality prevents publication of the stale candidate and retains the prior packet |

Every invoked downstream agent is checked for the original source ID and fact ID, and both requested Nov 4–6 and authorized Nov 1–3. Quality must receive the draft along with source material. These checks are asserted again outside the agent harness so an assertion cannot accidentally count as an expected injected API error. All original document contents and hashes must remain unchanged. Starting an overlapping run returns 409; redelivering a finished run makes no additional model calls. Blocked scenarios must receive an actual 409 from the approval API.

## Scope of the evidence

This verifies deterministic orchestration, handoff contents, failure classification, retries, persistence and approval gates. Injected SDK errors do not measure a real provider's latency or network behavior. Model reasoning, factual entailment of arbitrary paraphrases, and the ability of a live Quality model to find every error require genuine recorded or live-model evaluations. The test's passing Quality response is not clinical validation. Human source review remains required.

Stale-input errors currently surface as a generic failed agent/run rather than a dedicated stale-input reason. The candidate is safely rejected, but improving that diagnostic requires backend work outside this frontend-only task.

## Observed local results — November 4, 2026

- All 18 matrix scenarios and the independent aggregate verification passed against fresh, isolated PostgreSQL databases.
- The existing 326 unit tests across 20 files passed.
- The existing `npm run test:integration` passed its full journey, concurrent approval, identical rerun, duplicate execution, immutable history, authorization, failed dependency, database grants, spend concurrency and auth-throttle checks.
- Stale-input verification confirmed that a new source really persisted during Quality, all three model calls used one attempt, the stale candidate did not replace the previous packet, and approval returned 409. This distinguishes stale publication from an API-call failure.
- No production backend code changed. All source originals remained unchanged. No live model calls were made.
