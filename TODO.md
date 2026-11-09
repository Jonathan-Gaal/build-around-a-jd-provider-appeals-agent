# Backend handoff — 2026-11-05

Resume from `.worktrees/build`, branch `feature/backend-base`. The root checkout's README is older than the backend work. Setup/API notes: `BACKEND.md`.

## Saved and verified

- 286 unit tests pass; TypeScript, lint and production build pass (Next.js 15.5.29).
- `npm run eval` passes: deterministic fixture checks, fake client, zero live calls. It measures no model quality.
- Fresh PostgreSQL integration passes after the final changes: full UR-1042 upload/verify/resolve/rerun/approve flow, concurrent approval, identical rerun, duplicate execution, immutable history, cross-case API access, failed/skipped agents, stale sweep, late worker, audit trigger, document grants, CHECK invariants, same-case foreign keys, spend controls and login throttling.
- The composite same-case constraints apply on a fresh database. All five foreign keys refuse a cross-case write by name, with same-case controls.
- Stale runs (TRD §2.7) are swept on `GET /api/runs/:id`, `GET /api/cases/:id`, `GET /api/cases/:id/validation`, approval and run start. Open agent runs become `timed_out` with `error_kind = stale`. A late worker cannot undo the sweep and still settles its spend.
- New tests were shown able to fail: reverting the agent status, the approval sweep, the poll sweep or the late-worker guard, or removing a foreign key, each fails the suite.
- Auth.js over real HTTP against a production build: sign-in sets an `HttpOnly` session cookie, session and `/api/cases` work, sign-out ends it. Wrong credential, wrong Origin and missing CSRF are refused. Local `http` only, so the `Secure` flag is not exercised.
- `claude-haiku-5-5` ID and prices ($0.10/$0.50 per million) match the Claude API skill's table, cached 2026-10-06. The API call itself has not been made. The over-100K-token price tier is unreachable under the 100K-character case limit.
- Fake model clients only. Zero live model calls. Hosted/live quality verification is not complete.

## Remaining work

- [x] Push the follow-up commit to shared `development` and the fork feature branch (2026-11-05).
- [x] Hosted Neon project `ur-appeals` (2026-11-05): app and ledger databases migrated, restricted logins created, full integration passed through the pooler with fake clients. Production runs replay-only: with no `ANTHROPIC_API_KEY` or `SPEND_LEDGER_URL` set, a live run is refused (`503 ledger_unavailable`).
- [ ] Once the tested shared ledger is configured, record real replays and run live structural/grounding checks under the authorized $26 ordinary testing stop. The $10 demo reserve needs human unlock. Never print/read secret files. Latest workable date is about Nov 9.
- [ ] On the first live run, watch for `truncated`. Haiku 5.5 thinks by default and agent `maxTokens` is 6000–8000, so thinking may consume part of that budget.
- [ ] Frontend handoff to Umer: API routes and JSON shapes in `BACKEND.md`, no frontend screens implemented by this track. No submission path. Denial/appeal/letter features and Should work remain deferred by D8.

## Decisions for the human

- [x] Production advisories: `next` → bundled `postcss` 8.4.31 (high). Fixed without the Next 16 upgrade by an npm `overrides` entry pinning Next's `postcss` to 8.5.32; `npm audit --omit=dev` reports 0, and the production build passes (2026-11-09). Drop the override when upgrading Next.
- [ ] Remaining dev-only advisories: `drizzle-kit` → `esbuild` and `@typescript-eslint` → `minimatch` (moderate). Not shipped to production. `npm audit`'s suggested `drizzle-kit@0.18.1` is a downgrade and should not be applied.

## Observations

- `claim_evidence` links a claim to a span with no database same-case constraint, because `evidence_spans` has no `case_id`. Today spans come only from `verifyQuotes` over the case's own documents, so this is enforced in code only.
- The stale sweep runs on case read and gate reads but not on the claims, issues and documents list reads. The UI's case and run polling triggers it.

## Test setup notes

The temporary local Postgres cluster does not survive a reboot. Recreate it: `initdb -D <dir> -U urtest --auth=trust -E UTF8`, then `pg_ctl -D <dir> -o "-p 55432 -c listen_addresses=127.0.0.1" -w start`. The full-flow runner requires a fresh database ending `_test`; do not run it against application data or reset an application's spend ledger.

CLI: set `APP_DEPLOYMENT=local`, a test `DATABASE_URL`, `AGENT_REPLAY=1`, and `DEMO_NOW=2026-11-03T09:00:00-05:00`. Run `npm run db:migrate`, then `npm run test:integration`. The runner supplies fake clients internally. Sandbox local connections/tsx/build workers may require escalation.

## Recorded contract changes

- Login adds `login_throttles` for rolling windows and exact 15-minute blocks.
- Database runtime ledger role is named `spend_rw` (older schema notes name it differently).
- Quote exemptions require whole-string equality or explicit quotation context, tightening spec 006 to avoid masking an unquoted clinical determination.
- `docs/` kept read-only; update canonical team docs through the agreed handoff process.
