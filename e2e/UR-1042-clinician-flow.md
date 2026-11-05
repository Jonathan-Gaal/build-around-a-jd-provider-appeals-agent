# UR-1042 clinician frontend acceptance test

## What is being tested

The actual React/Next screens, Auth.js credential/CSRF/session-cookie roundtrip, existing backend handlers and orchestrator, real PostgreSQL migrations/seed/persistence, source verification, issue resolution, approval, history invalidation and audit writes.

Only the model client is deterministic test data. `ur1042-server.ts` uses the same injection seam and source-quote pattern as `scripts/backend-integration.ts`. It does not edit backend modules, forge replay recordings, bypass the approval gate, or call a paid provider. The first prepared packet is created by the existing orchestrator with a quote from the original Nov 3 fixture. An API response header makes the case screens visibly say **Isolated browser test · Deterministic fake model clients · Real backend and test database**.

The test listener is bound to 127.0.0.1, accepts only the explicit test origins on ports 3002 or 3004, and requires a fresh local database ending `_test`. It refuses a database that already contains cases. Normal application data and rate counters are never reset.

## Start a fresh run

1. Build the frontend with `npm run build`. Stop development servers before building. The harness uses `next start` by default and can share the resulting read-only build with the main app. `--dev` is available for frontend development; it uses the same `.next` directory, so stop the main server first and reload the browser after source changes.
2. Create a new isolated PostgreSQL database with a name ending `_test` using the existing local database service. Do not reuse the application database or a previous mutated test database.
3. Supply `APP_DEPLOYMENT=local`, `APP_ORIGIN=http://127.0.0.1:3002` (or port 3004), and the test `DATABASE_URL` to the harness process. Use the existing configured `AUTH_SECRET` and `DEMO_CREDENTIAL_CLINICIAN_A`. Keep secrets in local environment configuration, never in source control or test reports. Retain the synthetic demo clock `DEMO_NOW=2026-11-03T15:00:00-05:00`.
4. Run `npm run test:ui:server`. The harness applies the repository's migrations, seeds the existing synthetic case, prepares the initial packet using fake clients, and starts Next on the adjacent private port. Its console prints the test URL and mode without credentials.
5. Sign in with `clinician_a` and the configured demo credential. The separate 127.0.0.1 origin keeps the normal localhost demo's browser storage independent.

No model API key or replay files are required for this test. This is not a live-model or hosted-deployment quality test.

## Browser sequence and observed results

| Step | Browser action | Expected and observed result |
| --- | --- | --- |
| 1 | Sign in and open the queue | Auth.js succeeds; UR-1042 has two blocking issues and the fixed demo deadline |
| 2 | Open Summary | A real persisted prepared packet is present; Nov 2 is absent and no statement is invented from that note |
| 3 | Open Sign-off | Sign-off is disabled and server blockers are named |
| 4 | Open Evidence | The selected claim highlights the exact original Nov 3 source passage with metadata, offsets and fingerprint |
| 5 | Attach note | Choose `fixtures/ur-1042/late-arrival/note-2026-11-02.md` through the file picker, inspect its original text, then click Attach, verify and resolve |
| 6 | Observe the attachment result | The backend saves and verifies a new original source, schedules a real test run and resolves the missing-note issue; author, service date, version and actual receipt time appear |
| 7 | Verify dates | Read both original source records. The empty reason blocks saving. Record the reason for requested Nov 4–6 versus authorized Nov 1–3; neither range changes |
| 8 | Recheck | Start another review run; all three named agents complete and deterministic validation clears |
| 9 | Review sign-off | The current version/hash and included claims are read-only; the button remains disabled until explicit acknowledgement |
| 10 | Sign off | Existing POST /approve returns the actual clinician, timestamp, approval ID, packet ID and hash. The receipt matches that exact packet |
| 11 | Reload | The browser retains the captured server receipt, while current eligibility still comes from server validation |
| 12 | Edit afterward | In Evidence, prefix the existing claim with `Reviewed wording: ` and save. The backend creates a new packet version and invalidates the old approval |
| 13 | Return to Sign-off | The previous receipt is visibly not current; the old hash is preserved and a fresh acknowledgement is required |
| 14 | Fail Quality in the test harness | Arm the test-only failure control, then start a fourth run from Recheck. Clinical Documentation and Assembly remain completed; Quality fails after exactly two attempts; the run is Incomplete |
| 15 | Open Sign-off | The incomplete run is named as a blocker and sign-off stays disabled |
| 16 | Flag a citation | A written reason is required. The backend marks the claim unsupported and the gate names the material-claim blocker |
| 17 | Reject that claim | It is excluded from the packet; the original source remains readable. Editing controls disappear and the rejection/exclusion feedback remains visible. An empty packet cannot be signed off |

The named failure control exists only in this test harness: POST `/__test/fail-next-quality` with an Origin header equal to the test origin. It does not exist in the application API. Four runs cover the prepared initial packet, note-triggered rerun, clinician recheck and failed-run example, preserving the existing four-runs-per-case/hour limit. Use a fresh test database for another complete run rather than modifying the limit.

## Machine-checked evidence

GET `/__test/report` reads actual test database records. Save its JSON at these checkpoints:

- `.e2e-results/signed-off.json` after step 10 or 11.
- `.e2e-results/invalidated.json` after step 13.
- `.e2e-results/failed-run.json` after step 15, before the additional flag/reject tests.

Run `npm run test:ui:verify`. It checks exact packet/hash approval binding, unchanged original sources, separate date ranges, resolved issues, old approval invalidation with preserved history, audit actions, retained completed agents, Quality's one retry, and zero live model calls. Generated reports and screenshots are ignored by Git.

The verified run used database `ur_clinician_ui_20261104_02_test`. It reached one valid approval for packet v2, then invalidated it on creation of v3. Eight documents were present after upload; all seven original documents stayed unchanged. The failure checkpoint retained two successful agent results and a Quality failure with two attempts. All machine evidence assertions passed. The approval screen was also checked at a 375px viewport without horizontal overflow.

## Frontend fixes and limits

- Claims are requested for the displayed packet ID. Case metadata is checked again after the parallel reads; mixed snapshots retry and fail closed rather than showing another packet's claims.
- Slow polling is sequential, and superseded requests cannot replace a newer snapshot.
- Sign-off requires the exact stored/recomputed packet hash, completed run, no server blockers, and no source received after that run began. A new packet/hash resets acknowledgement.
- The receipt uses only the successful server response, scoped to the signed-in user and case. Browser storage never grants approval. Another browser can display the current signed-off state, but the existing read API cannot retrieve historical actor/time receipts. A cross-browser approval-history API remains backend work.
- Both Windows and Unix line endings of the known synthetic note pass the frontend's file check; original content is submitted unchanged, and the existing backend allowlist remains authoritative.
- Live model quality, genuine recorded replays, hosted database permissions and general clinical readiness are outside this frontend test. The normal app still requires valid replay recordings or an explicitly configured model environment for agent runs.

## Automated checks

`npm test` (326 tests), `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the evidence verifier. No production backend, auth, database, agent, API or orchestrator module is changed by this frontend branch.
