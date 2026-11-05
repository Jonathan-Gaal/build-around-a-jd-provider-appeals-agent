# Role-flow frontend previews

Historical preview reference. The active `/roles/*` pages now use real authenticated accounts and server-enforced case permissions; see [role logins](role-logins.md). The browser-only actions described below are no longer the active workspaces.

The user requested the Penpot future-role wireframes as frontend-only application flows. These previews extend the visual demo; they do not extend the backend's clinician account permissions or the clinical MVP's role model.

Reference: Penpot file `08b470c5-dda4-812a-8008-e46ad6758ba9`, PRD v3 Role map, Coordinator, Manager and Submission staff future boards, read in the earlier November 4 comparison. The connector was disconnected during implementation; the previously observed board contents supply the design reference.

## Shared flow

`/roles` introduces each role and its handoff boundary. A Role flows link is available in the shared responsive navigation. Role previews share day/night mode, typography, cards and Motion transitions with the clinician workspace.

Preview actions are retained in browser storage under a distinct versioned key. A persistent banner explains that these actions do not update the real case, grant permissions, or transmit records. The clinician workspace link opens the existing authenticated case flow. Source collection or assignment in a preview does not claim to resolve live clinical issues.

The backend, authentication, agents, API, migrations and clinical approval logic are not modified. The existing login remains the clinician demo login. Browser role selection is navigation only.

## Coordinator


`/roles/coordinator`: request demo note → inspect original synthetic note → attach it to preview inventory → mark source collection ready → open the existing clinician workspace. The handoff button stays disabled until the source is present. Source metadata and its fingerprint are preserved; the static preview text is checked against the existing fixture. Clinical date issues and clinician verification remain distinct from source collection. Local action history records request, attachment and handoff.

## Manager

Manager preview: `/roles/manager` shows the synthetic team queue, deadline, current handoff stage, reassignment controls and escalation routing. Assignment and routing events are shared with the other preview screens through browser storage. Neither action clears source gaps, date issues or clinical approval requirements.

## Submission staff

`/roles/submission` offers three explicitly illustrative snapshots: awaiting sign-off, approved example, and changed packet. Selecting a snapshot never creates a clinical signature. Preparation checks both version and fingerprint. Only the exact approved example can be prepared and receive a local fictional handoff reference. Changing scenarios clears the prepared version; an earlier receipt is retained as a previous, non-current record.

Destinations are offline preview labels. Receipt references must begin with `DEMO-`. No documents are exported, no external channel is contacted, and no payer receipt is claimed. The existing clinician sign-off screen remains a distinct link to the actual case.

## Branch review order

These branches are stacked on the existing frontend work: `codex/ur-role-map` → `codex/ur-coordinator-flow` → `codex/ur-manager-flow` → `codex/ur-submission-flow`. The final branch contains all role previews. Each commit describes its scope. Nothing is merged into development automatically.

## Verification and replay

The shared Start a fresh role walkthrough control resets only the browser-local preview after an explicit in-app confirmation. It leaves the live case untouched. The browser walkthrough verified missing-source handoff blocking, request and source attachment, clinician handoff, reload persistence, manager reassignment and reasoned routing, pending submission blocking, exact-version preparation and demo receipt, changed-packet blocking, preservation of the old receipt, and reset persistence. All four role screens fit at 375px without horizontal overflow; the submission preview also fits at 320px. Desktop cards were visually checked at 1280px and viewport overrides were reset.

The automated suite contains 312 passing tests, including source-fixture consistency, coordinator handoff gates, manager scope preservation, exact-version/fingerprint checks and receipt invalidation for the preview. The TypeScript, lint and production-build checks cover the complete frontend.
