# Penpot implementation coverage

Reference: UR-1042 Clinician Review Workspace, file `08b470c5-dda4-812a-8008-e46ad6758ba9`. Compared against the viewer on November 4, 2026, including the 11 PRD v3 clinician states and the refined workspace screens.

The earlier implementation delivered the five main case tabs but did not reproduce the complete prototype. This checklist distinguishes working frontend behavior from data and services the existing backend does not provide.

| Design area | Frontend implementation | Remaining dependency or boundary |
| --- | --- | --- |
| Refined queue | Search, filters, actual counts, deadline list, overview sidebar, next-review link | Uses one seeded case; does not invent other assigned cases |
| My reviews | Assigned cases with working links | Same assignment API as queue |
| Requests | Open issues across assigned cases, links to resolution | Coordinator messaging is outside PRD v3 MVP |
| Activity | Source receipt and packet creation updates | Full audit-event API does not exist; this is explicitly not a full audit trail |
| Profile | Fictional seeded clinician identity, review context, permissions, preferences links | Uses the seeded demo account; no account administration |
| Notifications | Editable preferences retained in browser storage | No delivery service; controls are labeled demo preferences |
| Day / night | Shared theme across workspace and case pages | Browser preference |
| Logo and avatar | Logo returns to queue; avatar opens profile menu | Sign-out is a separate explicit action |
| Motion | Page fades and menu fade using Motion, reduced-motion setting respected | No decorative or looping clinical-screen motion |
| Summary / Evidence | Existing API claims and exact source passages | Seed does not include a prepared packet; agent replay fixtures or an enabled model are required |
| Issues / attached note / dates | Existing upload, verification and issue routes | Synthetic allowlist remains enforced by the backend |
| Recheck / incomplete run | Existing run API and individual agent states | No generated result is fabricated when replay data is absent |
| Blocked / ready / signed-off / invalidated | Validation and exact version/hash controls | GET case response has no approval actor/time record; do not invent those fields |
| New-review intake | Not implemented | PRD v3 MVP uses the existing single case; there is no create-case route |
| Denial and other roles | Not implemented | Marked future in PRD v3 and Penpot |

Prototype-only shortcuts such as “show failed-run example” or “show changed-packet state” must not mutate or falsify the real review state. Run failures and packet changes must come from existing persisted state.
