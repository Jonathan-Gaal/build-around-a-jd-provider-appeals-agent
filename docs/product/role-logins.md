# Role logins and case permissions

The synthetic MVP now has real, separate Auth.js credentials and persisted identities. The role pages replace the previous browser-only role previews. A dropdown selects an account to authenticate; it does not grant a role. The database supplies the role after credential verification, and the session re-reads the database on each request.

## Accounts and workspaces

| Account | Database role | Landing page | Scope |
| --- | --- | --- | --- |
| `clinician_a` | clinician | `/` | Assigned clinician; original review and exact-version approval flow |
| `clinician_b` | clinician | `/` | Second fictional clinician; receives a case only after manager reassignment |
| `coordinator_a` | coordinator | `/roles/coordinator` | Explicit team cases; read records and attach allowlisted sources, which remain unverified |
| `manager_a` | supervisor | `/roles/manager` | Explicit team cases; monitor records/issues and assign eligible clinicians |
| `packet_a` | packet_staff | `/roles/submission` | Explicit team cases with a current valid approval; read-only signed packet |

The existing `supervisor` role is displayed as Manager. Only `packet_staff` is added to the database role enum. The additive migration creates `case_members`; it does not replace existing cases, sources, packets or approvals. Re-running the seed adds the fictional accounts and memberships without resetting case assignments or edits.

Each account requires its own `DEMO_CREDENTIAL_<ACCOUNT>` environment entry, at least 20 characters. `.env.example` contains keys only. Missing credentials deny login; no password is embedded in code or the UI. Locally generated credentials are kept in ignored `.env.local` and `.role-demo-logins.txt`. These are synthetic demo accounts, not self-service registration or a production identity-management system.

## Enforcement

- Server-rendered pages require the correct role. A different role is redirected to its own home; signed-out visitors go to sign-in. A clinician's case page also checks current assignment before rendering.
- Every API route checks the role and case scope independently of the UI. Clinicians can access only cases assigned to them. Other roles need explicit `case_members` membership; there is no global manager override.
- Coordinator and manager accounts may read their authorized case data. Only coordinators and clinicians may upload. Verification, clinical claim edits/flags, issue resolution, rechecks and sign-off remain clinician-only.
- Only managers may change assignments, and only to a clinician in that case's eligible membership list. Active runs prevent reassignment. An expected-current-assignee check refuses stale changes rather than silently overwriting them.
- Reassignment runs under the case lock, updates open-issue owners, invalidates existing approvals and writes an audit event. The previous clinician loses access immediately on the next request; the new clinician must explicitly sign off.
- Packet staff cannot read the generic case, source-document, claim or run endpoints. Their queue contains only currently signed-off packets. The packet endpoint revalidates status, latest run, source freshness, blockers, version, hash and valid approval under the case lock. Invalidated, changed or incomplete packets return 409; approval never derives from browser state.
- Session identity and role are re-read from the database, so old encrypted JWTs do not preserve removed roles or deleted accounts. Membership and assignment are checked again for every case request. A role field submitted with login is ignored.
- Existing origin, body-size, throttling, immutable-source, audit, quote-validation and human approval protections remain. No clinical determination, payer transmission, simulated payer receipt or permission-switch button is added.

## Validation

`npm run test:roles` requires a fresh local database ending `_test`, with the existing migrations applied. It tests five real persisted identities; role authentication; cross-role write denials; coordinator upload remaining unverified; clinician verification and approval; an exact approved packet; active-run assignment refusal; eligible assignment; stale assignment conflicts; previous clinician access revocation; approval invalidation; new-clinician approval; revoked membership; and unassigned manager isolation. Agent outputs in this integration test use existing fake-client seams; no paid model calls occur.

`npm run test:role-sessions` exercises real Auth.js cookies over HTTP. Start the production build against a separate fresh migrated test database with `APP_ORIGIN=http://127.0.0.1:3006` on port 3006, and give the test process the same configuration. The test seeds accounts, signs in all five, checks their own pages, rejects cross-role pages/API sign-off, changes a role while retaining its old cookie, and removes a synthetic identity to prove immediate rejection. It mutates only this isolated test database and refuses a reused populated one.

Observed locally: both suites passed. Browser checks also confirmed coordinator attachment with both clinical issues still open, persisted manager reassignment to Clinician B, redirecting managers away from clinician pages, the packet-staff empty state before approval, and Clinician B opening the reassigned case. Source documents in the normal demo were not changed by these browser tests.

The complete unit regression suite has 322 passing tests after updating the former clinician-only permission assertions for the new role matrix. The earlier 18-scenario agent failure matrix remains available; roles do not change agent definitions or prompts.
