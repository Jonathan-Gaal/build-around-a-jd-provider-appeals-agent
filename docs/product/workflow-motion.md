# Workflow motion

Animations use the existing Motion React dependency and do not control clinical state, permissions, validation or approvals. Transitions last 180–220ms; there are no looping effects, fake percentages, artificial loading delays or completion callbacks that advance the workflow.

| Area | Behavior |
| --- | --- |
| Agent progress | State text fades on a real run/status change. Successful agents gain a check mark; queued, incomplete and timed-out states stay explicit. Polling the same state keeps the same animated element. Agents display in pipeline order: Clinical Documentation, Assembly, Quality. |
| Evidence | Selecting a verified passage briefly emphasizes its existing highlight. Exact quote bytes, offsets, document hash and source text remain unchanged. No automatic scrolling or focus movement. |
| Issues | Resolved status changes gently, and neighboring cards can settle into position. Resolved issues and their written reasons remain visible. |
| Uploads | A small progress notice explains that the app is waiting for the server. Confirmation appears only after the write and reload. Coordinator attachments remain unverified; clinician verification/resolution remains explicit. |
| Assignment | The persisted current clinician is separate from the selection control. A new selection does not change the current assignee or produce success feedback; confirmation follows the successful API write and reload. |
| Sign-off | The real server receipt and confirmation reveal after approval. The exact version/hash acknowledgement and all blockers remain unchanged. |
| Invalidation | The fresh-review notice appears and persists while relevant. The old success state is removed immediately; no exit animation retains a false approval message. |

New feedback uses live regions for meaningful state changes and preserves control focus. Reduced motion disables new fades, movement and layout transitions. `useWorkflowReducedMotion` subscribes to the browser media preference, including changes while the page is open. Server-rendered feedback initially stays still until the browser preference is known. The existing global MotionConfig remains in place.

## Verification

- Five DOM/component tests exercise the real React/Motion components: initial reduced motion and preference changes; immediate failure text without lingering success; focus preservation; unchanged exact quotations; persistent issue and invalidation text; and disabled approval/unchecked acknowledgement remaining unchanged during receipt presentation.
- All 327 tests across 21 files passed. JSX transformation is enabled in Vitest for these component tests; jsdom and its types are development-only dependencies. The tested environment uses Node 24.22.1; jsdom 30 requires Node 22.22.2+, 24.15+ or a supported newer release.
- Production build, TypeScript and lint checks passed.
- In an isolated PostgreSQL browser journey, a coordinator upload showed pending feedback followed by attached/unverified confirmation. Both issues remained open. The clinician verified the source and dates, saw both resolved issue cards retained, started a real persisted recheck, and observed queued then complete agent states.
- The acknowledgement was initially unchecked and sign-off disabled. Explicit sign-off produced a real approval and animated receipt. A subsequent wording edit created v3, removed the signed state, displayed the persistent invalidation notice and reset acknowledgement.
- An injected test-only Quality failure retained two completed agents and blocked sign-off. Selecting another clinician in the manager UI left the current-assignee display unchanged until Save succeeded, then showed the persisted new clinician and confirmation.
- The browser acceptance journey used standard motion; reduced-motion and live preference changes were verified in the DOM tests, not by changing the user's operating-system settings. Test model responses were deterministic fake clients; database, validation and approval behavior were real. No live model calls, clinical determinations or payer transmissions occurred.

Screenshots and database reports are local under ignored `.e2e-results/`. A screenshot records the settled state; it does not itself prove animation timing.
