# Database schema

PostgreSQL, defined in Drizzle at `lib/db/schema.ts`. This mirrors the PRD's data model. IDs are UUIDs unless noted; every table has `created_at`. Enum values are listed in brackets.

## Cases and people

**users**: `id`, `email`, `name`, `role` [clinician, coordinator, supervisor, admin]

**cases**: `id` (text, e.g. `UR-1042`), `type` [concurrent_review, denial], `patient_label` (pseudonym), `service`, `level_of_care`, `facility`, `payer`, `plan`, `assigned_to` → users, `due_at` (timestamptz), `status` [imported, processing, needs_review, rework, awaiting_document, escalated, ready_for_approval, approved_for_submission, payer_approved, denied, appeal_in_progress], `synthetic` (bool, always true)

**review_periods**: `id`, `case_id`, `requested_start`, `requested_end` (date), `review_point`, `rationale_claim_id` → claims, `version`

**authorizations**: `id`, `case_id`, `auth_number`, `status`, `approved_start`, `approved_end`, `units`, `source_document_id` → documents, `last_verified_at`

**denials**: `id`, `case_id`, `reason_text`, `denied_start`, `denied_end`, `appeal_deadline`, `source_document_id`, `chosen_next_step` [accept, peer_to_peer, resubmit, appeal, null]

## Documents and evidence

**documents**: `id`, `case_id`, `type` [intake, treatment_plan, progress_note, authorization_record, denial_letter, policy, criteria_summary], `title`, `author`, `service_date`, `received_at`, `version` (int), `content` (text), `content_hash`, `supersedes_id` → documents. Rows are never updated; a new version is a new row.

**evidence_spans**: `id`, `document_id`, `start_offset`, `end_offset`, `excerpt`, `method` [verified_quote, manual]

**claims**: `id`, `case_id`, `packet_version_id`, `text`, `type` [clinical_fact, administrative_fact, criteria_finding, narrative, objection], `source_kind` [direct_quote, extracted_fact, clinician_text, agent_synthesis], `status` [agent_prepared, source_verified, unsupported, clinician_edited, clinician_approved, stale], `material` (bool), `author` (agent name or user id)

**claim_evidence**: `claim_id`, `evidence_span_id` (many-to-many)

## Policy and appeal data

**policy_rules**: `id`, `payer`, `policy_id`, `policy_version`, `effective_from`, `effective_to`, `requirement`, `evidence_span_id`

**appeal_cases** (loaded from `data/processed/`): `case_id` (text), `state` [NY, CA], `year`, `diagnosis`, `diagnosis_detail`, `treatment_raw`, `care_level`, `health_plan`, `coverage_type`, `decision` [Overturned, Upheld, Partly overturned], `age_range`, `gender`, `summary`, `references`, `after_the_fact`, `criteria_cited`, `holdout_packet`, plus a generated `search` tsvector over summary and diagnosis for the Case Match prefilter.

## Issues, runs and approval

**issues**: `id`, `case_id`, `type` [missing_document, date_conflict, unsupported_claim, stale_policy, extraction_uncertain, insurer_objection, other], `severity` [critical, major, minor], `blocking` (bool), `owner_id`, `status` [open, awaiting_document, in_rework, escalated, resolved], `source` (agent or user), `due_at`, `resolution_reason`, `resolution_evidence_id` → documents

**agent_runs**: `id`, `case_id`, `run_group_id` (one orchestrator run), `agent`, `agent_version`, `model`, `input_hash`, `input_document_ids` (uuid[]), `output` (jsonb), `status` [running, succeeded, failed, replayed], `error`, `input_tokens`, `output_tokens`, `cost_usd`, `started_at`, `finished_at`

**packet_versions**: `id`, `case_id`, `version` (int), `kind` [review_packet, appeal_letter, p2p_points, document_request], `content` (jsonb), `content_hash`, `validation_report` (jsonb)

**approvals**: `id`, `packet_version_id`, `content_hash`, `approved_by` → users, `role`, `acknowledgement` (text), `status` [valid, invalidated], `invalidated_reason`

**audit_events**: `id`, `actor` (user id or agent name), `action`, `object_type`, `object_id`, `object_version`, `outcome`, `correlation_id`. Insert-only: no updates or deletes.

## Rules the code enforces

- Documents and audit events are append-only.
- An approval is valid only while its `content_hash` equals the latest packet version's hash.
- A claim whose evidence document was superseded becomes `stale` until rechecked.
- Case Match queries exclude `appeal_cases` where `holdout_packet` is true for the packet being tested.
