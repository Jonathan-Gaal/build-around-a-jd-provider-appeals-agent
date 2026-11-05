# UR-1042 backend

Implemented in the backend track: Postgres/Drizzle migrations and synthetic seed, Auth.js demo login, case/document/claim/issue APIs, three-agent execution, evidence verification, shared spend controls, packet hashing, transactional approval and invalidation. The frontend scaffold is separate work.

## Local setup

1. `npm ci`.
2. Copy `.env.example` to `.env.local`. Set `APP_DEPLOYMENT=local`, `DATABASE_URL`, `AUTH_SECRET` (at least 32 characters), `APP_ORIGIN=http://localhost:3000`, and `DEMO_CREDENTIAL_CLINICIAN_A` (at least 20 characters). Credentials have no defaults. Never commit the populated file.
3. Run `npm run db:migrate` as the database owner, then `npm run db:seed`.
4. Use a restricted application database login with membership in `app_rw` for serving. Migrations and seed need a separate owner/migrator connection. For a separate shared spend database, run the migrations there and give its runtime login membership in `spend_rw`. Runtime logins must not own the tables or be superusers.
5. `npm run dev`. Auth.js sign-in is `/api/auth/signin`: account `clinician_a`, credential from the environment.

CLI commands load `.env.local`. Seed is idempotent and never resets spend or creates agent outputs/packets/approvals. Hosted uploads accept only exact allowlisted synthetic fixtures; the late Nov 2 note's parsed body is the upload content, without its Markdown front matter.

## Hosted database (Neon)

Neon project `ur-appeals`, Free plan, AWS US East, provisioned through the Vercel Marketplace on the `jonathan-gaal777` team. It holds `ur_appeals_app` and `ur_appeals_ledger`. Their runtime logins are `app_login` (member of `app_rw`) and `spend_login` (member of `spend_rw`). Each can connect only to its own database and neither is a superuser.

- **Runtime URLs** use the pooled host with `sslmode=verify-full`.
- **Migrations and seed** use the owner's direct connection, passed as `DATABASE_URL` on the command, which takes precedence over `.env.local`. Don't store the owner URL. `npx neonctl connection-string --project-id <id> --database-name <db>` retrieves it.
- **Creating login roles:** use SQL. Neon's API and console add API-created roles to `neon_superuser`, which would defeat the restriction.
- **Hosted integration runs** need a fresh database ending `_test` and one grant from the owner, because the suite checks grants with `SET LOCAL ROLE`: `GRANT app_rw TO current_user WITH SET TRUE, INHERIT FALSE`. Set `SPEND_LEDGER_URL=` on the command so a run can't reach the real ledger.

## Model execution

**Period claims.** Code writes the requested and authorized period claims from stored values (`author: "code"`, type `administrative_fact`, section "Review periods"). They have no evidence rows, so show their source from the case's review period and authorization. A model claim citing a period ID is `unsupported` and blocks until a clinician edits or rejects it. The drafting prompt still asks for those claims, so expect two per run until it changes.

`runAgent()` is the only model caller. Live calls require `ANTHROPIC_API_KEY`, a reachable shared `SPEND_LEDGER_URL`, and available budget. Preview live calls are refused. Every attempt reserves budget atomically; ordinary spending stops at $26, with the separately unlocked demo stop at $36.

`AGENT_REPLAY=1` requires actual recordings matching the agent version, model and prompt. A missing recording fails visibly; the repo does not contain fabricated recordings. `AGENT_RECORD=1` records successful live responses. Production replay requires `REPLAY_PRODUCTION_LABELED=1`. `DEMO_NOW=2026-11-03T09:00:00-05:00` freezes business time only; audit, throttling and expiry use real time.

Live runs on Haiku 5.5 have been made under the spend stop. Replay recordings live in `.agent-replay/`, which is gitignored, so a fresh clone or a hosted deployment has none until they are copied or re-recorded.

## Terminal walkthrough

`npm run demo:walkthrough` shows the UR-1042 flow without a frontend: sign-in, three-agent review, late note, issue resolution and approval. It creates a temporary `_test` database, starts a production build in replay mode with a generated password and no API key or ledger, then deletes the database. It spends nothing and never touches `ur_appeals_app`. It needs port 3000 free, a Neon CLI login and local recordings.

## API

All case resources require the assigned clinician's session. Writes require an exact configured Origin and strict JSON bodies. Auth.js additionally uses its own CSRF protection.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/cases` | Assigned queue |
| GET | `/api/cases/:id` | Case, periods, authorization, latest packet/run, demo clock |
| GET / POST | `/api/cases/:id/documents` | List / upload source |
| GET | `/api/documents/:id` | Exact source text |
| POST | `/api/documents/:id/verify` | Verify or reject; clinical verification schedules full rerun |
| POST | `/api/cases/:id/runs` | Start fixed three-agent plan; body `{}` |
| GET | `/api/runs/:id` | Agent status, attempts, error kinds, costs |
| GET | `/api/cases/:id/claims` | Claims and source spans; optional `packetVersion` UUID |
| PATCH | `/api/claims/:id` | `{text}` or `{status:"rejected"}` |
| POST | `/api/claims/:id/flags` | `{reason}` marks citation unsupported |
| GET | `/api/cases/:id/issues` | Issues and allowed resolutions |
| POST | `/api/issues/:id/resolve` | Evidence-backed resolution |
| GET | `/api/cases/:id/validation` | Current hash, checks and approval blockers |
| POST | `/api/cases/:id/approve` | `{packetVersionId,contentHash,acknowledgement}` |

Missing-note resolution: `{resolution:"attach_document",reason,evidenceDocumentId}`. Date-conflict resolution: `{resolution:"verify_period",reason,evidenceDocumentId,verifiedPeriod:{start,end}}`; the verified request remains separate from authorization. Approval is idempotent, bound to the latest packet/hash, and cannot change clinical claim statuses. Editing an approved packet creates a new version. An identical rerun preserves the prior packet and approval.

There is no submission route. Denials, appeal matching, letter parsing, extra roles and Should features remain deferred by D8.

## Verification

- `npm test`: deterministic unit tests with fake clients; no paid calls.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- `npm run eval`: deterministic fixture/source/coverage/gate metrics, explicitly fake-client.
- `npm run test:integration`: real PostgreSQL plus fake model clients. Use a **fresh, isolated database whose name ends `_test`**, migrate it first, set `APP_DEPLOYMENT=local`, `AGENT_REPLAY=1`, `DEMO_NOW=2026-11-03T09:00:00-05:00`. It mutates only test fixtures and ledger state. Never point it at an application database.

The integration suite covers the full missing-note/date-conflict/approval flow, duplicate execution, concurrent approval, no false invalidation, immutable history, foreign-case route denial, failed/skipped runs, stale-run sweep and late workers, database grants/audit protection, CHECK invariants, same-case foreign keys, login throttling and spend settlement/expiry. Hosted Neon concurrency and live-model output quality still need environment-specific verification.

A stuck run recovers through normal polling: `GET /api/runs/:id`, `GET /api/cases/:id` and `GET /api/cases/:id/validation` mark a run with a heartbeat over 10 minutes old as `failed`, and its open agents as `timed_out` with `errorKind: "stale"`. Approval and run start do the same. Approval stays blocked until a new run completes.

## Frontend notes

- Claim text and other stored strings can contain markup. The API returns them as plain JSON strings, so render them as text and never with `dangerouslySetInnerHTML`.
- Verifying a clinical document starts a rerun itself. A second `POST /runs` returns 409 `active_run` with `activeRunGroupId`; poll that run.
- `next.config.ts` sends a Content-Security-Policy. Loading a script, font or API from another origin requires changing it.

## Known security limits

- Sessions are JWTs with an 8-hour life. Sign-out clears the browser cookie, but a copied token keeps working until it expires.
- Off Vercel, login throttling uses one shared IP bucket, and five wrong attempts lock an account for 15 minutes.

## Contract notes for review

- Backend API lives in the shared server dispatcher `lib/http/api.ts`, mounted by `app/api/[...path]/route.ts`; auth has its own route.
- Login uses an additional `login_throttles` table for exact rolling windows and blocks lasting 15 minutes from the fifth failure.
- Enum-like text columns have database CHECK constraints installed by `db:migrate`, alongside role grants and append-only audit triggers.
- Verified quote exemptions require either the whole output string to equal the quote or explicit quotation context. This deliberately tightens spec 006's broad every-occurrence rule, preventing an unquoted determination from hiding behind a matching source substring.
- `docs/` was kept read-only per the backend rules; earlier README/build-plan scope descriptions may be stale.
