# API contract

Route handlers under `app/api/`. All responses are JSON. **Every route checks the session and the user's access to the case on the server.** Errors return `{ error: string }` with a 4xx or 5xx status. Simple form actions (resolve issue, edit claim) may be server actions with the same rules.

| Method | Route | Body / query | Returns | Who |
| --- | --- | --- | --- | --- |
| GET | `/api/cases` | `?status=` | `CaseSummary[]` (id, patient, level, due, status, issue count) | Any signed-in role |
| GET | `/api/cases/:id` | | Case, review period, authorization, denial, latest packet version | Assigned users, supervisor |
| GET | `/api/cases/:id/documents` | | Document list with metadata | Same |
| GET | `/api/documents/:docId` | | Full document text and metadata | Same |
| POST | `/api/cases/:id/documents` | `{ type, title, serviceDate, content }` | New document version; triggers affected reruns | Coordinator, clinician |
| POST | `/api/cases/:id/runs` | `{ plan: "concurrent_review" \| "denial", agents?: string[] }` | `{ runGroupId }` (returns at once; work continues) | Clinician |
| GET | `/api/runs/:runGroupId` | | Each agent's status, timings, cost; overall status | Same as case |
| GET | `/api/cases/:id/claims` | `?packetVersion=` | Claims with evidence spans and statuses | Same |
| PATCH | `/api/claims/:claimId` | `{ text }` or `{ status: "rejected" }` | Updated claim (status `clinician_edited`); invalidates approval | Clinician |
| GET | `/api/cases/:id/issues` | | Issues with allowed resolutions | Same |
| POST | `/api/issues/:issueId/resolve` | `{ resolution, reason, evidenceDocumentId? }` | Updated issue. Refused if the resolution type isn't allowed for that issue | Per issue owner rules |
| POST | `/api/issues/:issueId/escalate` | `{ toRole, reason, dueAt }` | Updated issue | Clinician, coordinator |
| POST | `/api/cases/:id/denial` | `{ documentId }` | Starts the denial run | Clinician, coordinator |
| POST | `/api/cases/:id/next-step` | `{ step: "accept" \| "peer_to_peer" \| "resubmit" \| "appeal" }` | Starts Drafting in the matching mode | Clinician |
| GET | `/api/cases/:id/validation` | | Validation report and the list of blockers | Same |
| POST | `/api/cases/:id/approve` | `{ packetVersionId, contentHash, acknowledgement }` | Approval. Refused if blockers remain or the hash isn't current | Clinician |
| GET | `/api/cases/:id/audit` | | Audit events | Clinician, supervisor |

Every write creates an `audit_events` row. Nothing in this API sends data outside the app.
