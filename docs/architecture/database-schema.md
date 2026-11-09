# Database schema

PostgreSQL, defined in Drizzle at `lib/db/schema.ts`. This mirrors the PRD's data model. IDs are UUIDs unless noted; every table has `created_at`. Enum values are listed in brackets.

## Cases and people

**users**: `id`, `email`, `name`, `role` [clinician, coordinator, supervisor, admin]

**cases**: `id` (text, e.g. `UR-1042`), `type` [concurrent_review, denial], `patient_label` (pseudonym), `service`, `level_of_care`, `facility`, `payer`, `plan`, `assigned_to` → users, `due_at` (timestamptz), `status` [imported, processing, needs_review, rework, awaiting_document, escalated, ready_for_approval, approved_for_submission, submitted, pended_for_info, payer_approved, partially_approved, denied, appeal_in_progress, appeal_overturned, appeal_upheld, closed]. Status changes only through `lib/cases/transition.ts`, which writes an `audit_events` row; letter and appeal rows drive the payer-side states, `synthetic` (bool, always true)

**review_periods**: `id`, `case_id`, `requested_start`, `requested_end` (date), `review_point`, `rationale_claim_id` → claims, `version`

**authorizations**: `id`, `case_id`, `auth_number`, `status`, `approved_start`, `approved_end`, `units`, `source_document_id` → documents, `last_verified_at`

**payer_letters**: one row per letter the payer sends (replaces the old `denials` table). The letter itself is a `documents` row; this row holds the parsed fields.
- Identity: `id`, `case_id`, `document_id` → documents, `kind` [approval, partial_approval, denial, request_for_info, appeal_decision], `letter_date`, `received_at`, `auth_number`
- Dates and units: `requested_start`, `requested_end`, `approved_start`, `approved_end`, `approved_units`, `denied_start`, `denied_end`, `next_review_due_at`
- Denial details: `denial_category` [medical_necessity, administrative, benefit_exclusion, other], `reason_text`, `level_of_care_requested`, `level_of_care_offered` (the lower level the plan suggests), `criteria_cited` (text[])
- Reviewer (for procedural checks, FR-21): `reviewer_name`, `reviewer_credentials`
- Rights and deadlines: `p2p_deadline`, `appeal_deadline`, `expedited_appeal_available` (bool), `external_review_deadline`, `items_requested` (text[]) and `response_due_at` for requests for information
- Appeal decisions: `appeal_level` [internal_1, internal_2, expedited, external], `decision` [upheld, overturned, partially_overturned], `appeal_id` → appeals
- Evaluation: `parse_run_id` → agent_runs, `field_evidence` (jsonb: field name → `{ quote, start, end, status }`, every parsed field verified against the letter like a claim), `verification_status` [agent_parsed, clinician_verified, corrected], `verified_by` → users, `verified_at`, `chosen_next_step` [accept, peer_to_peer, resubmit, appeal, null]

**appeals**: one row per appeal level, so a case's history reads as a chain: `id`, `case_id`, `payer_letter_id` (the denial or decision being appealed), `level` [peer_to_peer, internal_1, internal_2, expedited, external], `status` [drafting, ready_for_approval, approved, submitted, awaiting_decision, decided, withdrawn, missed_deadline], `deadline`, `packet_version_id` (the approved appeal letter or P2P notes), `submitted_at`, `decision_letter_id` → payer_letters, `outcome` [overturned, upheld, partially_overturned, null], `decided_at`, `previous_appeal_id` → appeals

**submissions** (mocked; nothing is really sent): `id`, `case_id`, `packet_version_id`, `approval_id` → approvals, `channel` [mock_portal, mock_fax], `submitted_by` → users, `submitted_at`, `confirmation_number` (fake)

## Documents and evidence

**documents**: `id`, `case_id`, `type` [intake, treatment_plan, progress_note, authorization_record, denial_letter, approval_letter, request_for_info_letter, appeal_decision_letter, policy, criteria_summary], `title`, `author`, `service_date`, `received_at`, `version` (int), `content` (text), `content_hash`, `supersedes_id` → documents. Rows are never updated; a new version is a new row.

**evidence_spans**: `id`, `document_id`, `start_offset`, `end_offset`, `excerpt`, `method` [verified_quote, manual]

**claims**: `id`, `case_id`, `packet_version_id`, `text`, `type` [clinical_fact, administrative_fact, criteria_finding, narrative, objection], `source_kind` [direct_quote, extracted_fact, clinician_text, agent_synthesis], `status` [agent_prepared, source_verified, unsupported, clinician_edited, clinician_approved, stale], `material` (bool), `author` (agent name or user id)

**claim_evidence**: `claim_id`, `evidence_span_id` (many-to-many)

## Policy and appeal data

**policy_rules**: `id`, `payer`, `policy_id`, `policy_version`, `effective_from`, `effective_to`, `requirement`, `evidence_span_id`

**appeal_cases** (loaded from `data/processed/`): `case_id` (text), `state` [NY, CA], `year`, `diagnosis`, `diagnosis_detail`, `treatment_raw`, `care_level`, `health_plan`, `coverage_type`, `decision` [Overturned, Upheld, Partly overturned], `age_range`, `gender`, `summary`, `references`, `after_the_fact`, `criteria_cited`, `holdout_packet`, plus a generated `search` tsvector over summary and diagnosis for the Case Match prefilter.

## Issues, runs and approval

**issues**: `id`, `case_id`, `type` [missing_document, date_conflict, unsupported_claim, stale_policy, extraction_uncertain, insurer_objection, other], `severity` [critical, major, minor], `blocking` (bool), `owner_id`, `status` [open, awaiting_document, in_rework, escalated, resolved], `source` (agent or user), `due_at`, `resolution_reason`, `resolution_evidence_id` → documents

**run_groups**: `id`, `case_id`, `plan` [concurrent_review, denial, rerun], `status` [running, complete, partial, failed, budget_exceeded], `calls_used`, `tokens_used`, `cost_usd`, `started_at`, `finished_at`. Budget: 12 calls and 200,000 tokens per group (PRD section 8)

**agent_runs**: `id`, `case_id`, `run_group_id` (one orchestrator run), `agent`, `agent_version`, `model`, `input_hash`, `input_document_ids` (uuid[]), `output` (jsonb), `status` [queued, running, succeeded, needs_review, failed, timed_out, skipped, replayed], `error`, `error_kind` [timeout, api, schema, truncated, refusal, no_replay], `attempts`, `input_tokens`, `output_tokens`, `cost_usd`, `started_at`, `finished_at`

**packet_versions**: `id`, `case_id`, `version` (int), `kind` [review_packet, appeal_letter, p2p_points, document_request], `content` (jsonb), `content_hash`, `validation_report` (jsonb)

**approvals**: `id`, `packet_version_id`, `content_hash`, `approved_by` → users, `role`, `acknowledgement` (text), `status` [valid, invalidated], `invalidated_reason`

**audit_events**: `id`, `actor` (user id or agent name), `action`, `object_type`, `object_id`, `object_version`, `outcome`, `correlation_id`. Insert-only: no updates or deletes.

## Rules the code enforces

- Documents and audit events are append-only.
- An approval is valid only while its `content_hash` equals the latest packet version's hash.
- A claim whose evidence document was superseded becomes `stale` until rechecked.
- Parsed letter dates never overwrite `authorizations` or `review_periods` silently. A clinician verifies the parsed fields (`verification_status = clinician_verified`) before an approval letter extends an authorization or a deadline starts counting on the queue.
- A `decided` appeal with outcome `upheld` opens the next level's `appeals` row (internal_1 → internal_2 or external) with its deadline from the decision letter. `overturned` moves the case to `appeal_overturned`.
- The queue sorts by the nearest open deadline across `cases.due_at`, `payer_letters.p2p_deadline`, `payer_letters.response_due_at` and `appeals.deadline`.
- Case Match queries exclude `appeal_cases` where `holdout_packet` is true for the packet being tested.
