# Role-flow frontend previews

The user requested the Penpot future-role wireframes as frontend-only application flows. These previews extend the visual demo; they do not extend the backend's clinician account permissions or the clinical MVP's role model.

Reference: Penpot file `08b470c5-dda4-812a-8008-e46ad6758ba9`, PRD v3 Role map, Coordinator, Manager and Submission staff future boards, read in the earlier November 4 comparison. The connector was disconnected during implementation; the previously observed board contents supply the design reference.

## Shared flow

`/roles` introduces each role and its handoff boundary. A Role flows link is available in the shared responsive navigation. Role previews share day/night mode, typography, cards and Motion transitions with the clinician workspace.

Preview actions are retained in browser storage under a distinct versioned key. A persistent banner explains that these actions do not update the real case, grant permissions, or transmit records. The clinician workspace link opens the existing authenticated case flow. Source collection or assignment in a preview does not claim to resolve live clinical issues.

The backend, authentication, agents, API, migrations and clinical approval logic are not modified. The existing login remains the clinician demo login. Browser role selection is navigation only.

## Coordinator

`/roles/coordinator`: request demo note → inspect original synthetic note → attach it to preview inventory → mark source collection ready → open the existing clinician workspace. The handoff button stays disabled until the source is present. Source metadata and its fingerprint are preserved; the static preview text is checked against the existing fixture. Clinical date issues and clinician verification remain distinct from source collection. Local action history records request, attachment and handoff.
