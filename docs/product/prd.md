# PRD: Behavioral-health UR workspace and appeals agent

Nov 3, 2026 · Jonathan Gaal and Umer Bashir · [Live doc](https://claude.ai/artifact/Dg3c6wvHQgMbqFZrSY4RnV)

## 1. Summary and vision

This merges two drafts: Umer's concurrent-review workspace PRD and our denial-and-appeals PRD. The concurrent-review workspace is the base. Denials and appeals reuse the same evidence, issue and approval controls, and add what our real appeal data makes possible.

The product gives behavioral-health UR clinicians a workspace that assembles a review packet, shows the source behind every material statement, flags missing or conflicting information, predicts the plan's objections, and makes the clinician's review and approval explicit. When a denial comes in, it recommends a next step, shows similar real appeal decisions and drafts the response.

The workspace should answer three questions quickly: **What needs my attention? What evidence supports this statement? What action should I take?**

Agents gather, extract, reconcile, assemble and check. They never decide medical necessity, approve care or send anything on a clinician's behalf.

|  |  |
| --- | --- |
| **Version** | 2.0, merged draft. Status: proposed MVP |
| **Team** | Jonathan Gaal and Umer Bashir |
| **Built around** | [Ritten, Authorization (UR) Specialist](https://www.ritten.io/jobs/authorization-ur-specialist) |
| **Stack** | Next.js, TypeScript, React, SQL, Claude API |
| **Data** | Synthetic patients only, plus 3,680 real NY and CA appeal decisions |
| **Repo** | [Umer-Johnathan-JD-repo](https://github.com/umerbashir-del/Umer-Johnathan-JD-repo) |

## 2. Users and problem

| User | Need |
| --- | --- |
| **UR clinician (primary)** | Verify the draft against source records, use clinical judgment, correct or reject statements, and approve a specific packet version |
| UR coordinator | Get missing documents, resolve administrative discrepancies, track payer deadlines |
| UR manager or supervisor | Reassign work, watch overdue cases, handle escalations, see denial trends by plan |
| Submission staff (later phase) | Send an approved packet through an approved channel and record the receipt |
| Administrator and privacy officer (later phase) | Configure access, retention, audit review and disclosure rules |

Concurrent reviews require recent notes, payer requirements, service dates and existing authorizations to be reconciled under a deadline, and these sit in different systems. An unsupported statement, missing note or date conflict is hard to spot in a polished draft.

Denials make it worse. Each one costs hours: reading the letter, finding evidence in the chart, matching it to ASAM or LOCUS, writing the appeal and tracking the deadline. Many could be avoided if the first request had answered what the plan's reviewer would ask.

The Ritten JD names this whole cycle: prior authorizations, concurrent reviews, denials, appeals, peer-to-peer reviews, denial-trend tracking and denial prevention.

### JD coverage

Every JD duty maps to stories (below) and requirements (section 7). Gaps are listed on purpose so the demo doesn't imply full coverage. Full table: [docs/research/job-descriptions.md](../research/job-descriptions.md).

| JD duty | How the app covers it | Stories | Status |
| --- | --- | --- | --- |
| First line of defense against denials | Insurer Reviewer lists the plan's 3 likely objections with evidence before approval | US-07 | MVP |
| Initial authorizations with ASAM documentation | ASAM/LOCUS check (FR-06); full pre-cert workflow later (FR-24) | US-04, US-18 | Partial |
| Concurrent reviews and expiration tracking | Deadline queue, UR-1042 end to end, authorized vs requested periods | US-01–03, US-09 | MVP |
| Auth records and unit limits | Authorization Tracking checks dates and units against the request | US-06 | MVP |
| Retro-authorization requests | Not covered | none | Gap |
| Payer contact, peer-to-peer, appeals | Denial parsing, similar real cases, next step, appeal letter or P2P talking points; payer contact mocked | US-10–13, US-19 | MVP |
| Find authorization gaps | Missing notes and conflicts become blocking issues | US-05, US-06 | MVP |
| Report denial trends | Trends by plan and care type (NY data) | US-16 | Should |
| Coordinate with intake and clinical | Coordinator document requests with due times | US-15 | Should |
| Clean claims with billing; ICD-10 checks | Not covered | none | Gap |
| Commercial, Medicaid, Medicare across states | NY and CA data (commercial and Medicaid); no Medicare data | US-11 | Partial |

### User stories

Written for the JD's UR specialist (the UR clinician here), a UR coordinator and a UR manager. Each story's JD duty, FRs and acceptance criterion are in [user-stories.md](user-stories.md); story IDs name e2e tests.

**MVP**

- **US-01** Cases sorted by review deadline, so no authorization lapses.
- **US-02** Requested and authorized periods, deadline and a draft packet ready on open.
- **US-03** Every draft statement opens its source passage.
- **US-04** Each ASAM or LOCUS dimension marked met, unmet or unclear, with a quote.
- **US-05** Missing notes are blocking issues a checkbox can't close.
- **US-06** Auth-record vs request conflicts (dates, units) shown side by side, never silently changed.
- **US-07** The plan's 3 likely objections, with answering evidence, before approval.
- **US-08** Correct a statement or attach a late note; only affected agents rerun.
- **US-09** Approve one exact packet version; blocked until blocking issues are resolved.
- **US-10** Denial letter parsed into reason, dates and appeal deadline.
- **US-11** 3 to 5 similar real appeal decisions, won and lost, labeled by state.
- **US-12** Recommended next step with its reason and the external-review overturn rate.
- **US-13** Appeal letter or peer-to-peer talking points drafted, then challenged once.
- **US-17** (manager) Reconstruct the sources, agent runs and people behind any approval.

**Should:** US-14 procedural appeal checks · US-15 (coordinator) document requests with due times · US-16 (manager) denial trends by plan and care type.

**Later:** US-18 initial authorization prep · US-19 payer portal submission.

## 3. Goals, scope and non-goals

**MVP goals**

1. Complete one synthetic concurrent review (UR-1042) from intake to a clinician-approved packet.
2. Make every material clinical and administrative claim traceable to a source passage, or visibly mark it unsupported.
3. Surface missing records, conflicting dates, stale policies and uncertain extractions as actionable issues.
4. **Prevent denials:** before approval, show the plan's three most likely objections and the evidence that would answer them.
5. **Handle a denial:** parse the letter, show similar real appeal decisions, recommend Accept, Peer-to-peer, Resubmit or Appeal, and draft the chosen response.
6. Require a qualified clinician to approve the exact packet version, and keep an audit trail of sources, agent runs, edits, issue resolutions and approval.

**MVP scope:** case queue; case workspace with Summary, Evidence, Issues and Approval screens; a Denial view; synthetic documents and policy; the NY and CA appeal datasets; conditional agent orchestration; draft versioning; validation; audit history; approval recorded locally.

**Non-goals**

- Any agent decision on medical necessity, coverage or treatment.
- Real patient data. Real PHI would need privacy, security and legal review and BAAs with every vendor.
- Payer submission, EHR writeback or automated clinician signatures. Intake, submission and payer responses are mocked.
- Insurers' proprietary criteria (InterQual, MCG). We use public criteria: ASAM, LOCUS, LOCADTR.
- Medicare, which neither dataset covers.
- Pharmacy, surgery, TMS or experimental-treatment denials.
- Predicting a chance of winning. We show the overturn rate at external review, labeled as such.
- Pre-certification and discharge workflows. They share the architecture but come later.

## 4. Demo cases

Everything here is fictional and marked synthetic. Agents may only state clinical facts that appear in the synthetic source set; they may not fill gaps with plausible details.

**Case 1: UR-1042, concurrent review (from Umer's PRD)**

| Field | Synthetic value |
| --- | --- |
| Case | UR-1042, concurrent review, inpatient behavioral health |
| Patient | Patient A; no real identity |
| Payer | Payer North, a fictional plan and policy |
| Review point | Day 4 of the stay |
| Review due | November 3, 2026, 5:00 p.m. Eastern |
| Existing authorization | November 1 to 3, 2026 |
| Requested period | November 4 to 6, 2026 |
| Known issues | The November 2 progress note is missing; the requested period extends past the existing authorization |
| Initial state | Needs review, blocked for approval |

The date difference is a verification issue, not proof the request is wrong: a concurrent review may ask for more days. The workspace shows both periods and their sources and never silently changes dates to make them agree.

**Case 2: denial packets (from our PRD)**

Five synthetic packets (A to E), each built from a real NY appeal case, with an intake, treatment plan, progress notes, denial letter and a hidden answer key holding the real outcome. The demo uses a denied detox stay: the app shows NY case 201908-120030 (overturned) next to 201908-119701 (upheld). Packet details are in the repo's [synthetic patients doc](https://github.com/umerbashir-del/Umer-Johnathan-JD-repo/blob/main/docs/data/synthetic-patients.md). Each packet's source case is held out of matching when that packet is tested.

## 5. User journey and case states

**Concurrent review (UR-1042)**

1. **Open the queue.** Cases are sorted by deadline. UR-1042 shows "Needs review" with two open issues.
2. **Open Summary.** Review period, authorization, draft packet, agent status, blocking issues and the Insurer Reviewer's likely objections.
3. **Verify evidence.** Select a statement to see its source passage, with document date, author, version and extraction status.
4. **Resolve issues.** Request the missing note from a coordinator, correct a supported extraction, confirm a fact against its source, send targeted rework to an agent, or escalate. A reason and evidence are required where appropriate.
5. **Review approval.** Inspect the final packet and validation report. Approval is available only once required checks pass and blocking issues are resolved.
6. **Approve the version.** The system records the clinician, time, packet version and hash. The case becomes "Approved for submission"; nothing is sent.
7. **Reopen on change.** Any later change to a material fact, source, policy, dates or packet content invalidates the approval and returns the case to review.

**Denial**

1. The presenter marks the payer response as denied and uploads the synthetic denial letter.
2. Agents parse the letter (reason, dates, appeal deadline), check the chart against criteria, and find 3 to 5 similar real cases, won and lost.
3. The workspace recommends Accept, Peer-to-peer, Resubmit or Appeal, with the reason and the overturn rate at external review.
4. The clinician picks one. The agents draft an appeal letter, peer-to-peer talking points or a list of documents to add, and the Insurer Reviewer challenges the draft once.
5. The draft goes through the same Evidence, Issues and Approval screens. An upheld appeal comes back as a new denial.

**States:** Imported → Processing → Needs review → Rework, Awaiting document or Escalated → Ready for approval → Approved for submission. After the mocked payer response: Approved (track days, next review due) or Denied → Appeal in progress → back to Needs review. Approval invalidated returns to Needs review.

## 6. Screens

Desktop layout: case navigation and status on the left, working content in the center, the source viewer and agent findings on the right. On small screens these become tabs. The header always shows the case ID, case type, due time and time zone, packet version, status and number of blocking issues.

| Screen | Shows | Actions |
| --- | --- | --- |
| **Queue** | Assigned cases with deadline, status, issue count and last update | Open a case |
| **Summary** | Case facts; requested and authorized periods shown separately; deadline; draft narrative; agent status and freshness; issue banner; the Insurer Reviewer's top 3 objections | Open a claim's source; go to an issue; edit a statement; request targeted rework |
| **Evidence** | Document list and viewer with the cited passage highlighted; metadata; claim-to-source map; policy text and effective date. Labels quotes, extracted facts, clinician text and agent synthesis differently | Jump from a claim to its passage; flag a wrong citation; propose a correction; compare conflicting sources |
| **Issues** | Issue cards with severity, owner, source, effect on approval, due time, history and allowed resolutions | Request a document; attach a new source; correct a field; send rework; escalate; record a reasoned resolution. A checkbox alone can't close a missing document or date conflict |
| **Denial** | Parsed denial (reason, dates, deadline); 3 to 5 similar real cases labeled by state, outcome and the reviewer's reasons; recommended next step; overturn rate at external review | Pick Accept, Peer-to-peer, Resubmit or Appeal; open a matched case's full summary |
| **Approval** | Read-only preview of the exact packet version; source coverage and validation report; open issues; acknowledgement; approval history | Return for editing, request rework, escalate, or approve when eligible. Shows why approval is blocked |

Content is always labeled as agent-prepared, source-verified, clinician-edited or clinician-approved.

## 7. Functional requirements

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-01 | Must | Load a synthetic case with separate patient, service, payer, authorization, deadline and document records |
| FR-02 | Must | Show an assigned queue with deadline, status, issue count and last update |
| FR-03 | Must | Sign in with demo roles; check on the server, for every request, that the user may see that case |
| FR-04 | Must | Produce a versioned draft packet whose material claims link to source passages or carry an "unsupported" flag |
| FR-05 | Must | Show source metadata and the original passage for each citation. Never alter original documents |
| FR-06 | Must | Check the chart against public criteria: each ASAM or LOCUS dimension marked met, unmet or unclear, with the supporting quote |
| FR-07 | Must | Track missing documents and administrative conflicts as typed issues with owners, statuses and resolution evidence |
| FR-08 | Must | Run the Insurer Reviewer before approval and on appeal drafts, listing the 3 most likely objections with the evidence that would answer each |
| FR-09 | Must | Let a clinician edit or reject draft wording without changing the source record |
| FR-10 | Must | After a correction or new document, rerun only the affected agents, then rerun the quality check |
| FR-11 | Must | Block approval for missing required sources, unresolved critical issues, unsupported claims, failed validation, or a packet changed since review |
| FR-12 | Must | Record clinician approval against an immutable packet version and hash; invalidate it on any material change |
| FR-13 | Must | Keep an append-only audit history of access, extraction, edits, issue actions, validation, approval and export |
| FR-14 | Must | Parse a denial letter into plan, level of care, dates, reason and appeal deadline |
| FR-15 | Must | Show 3 to 5 similar real appeal cases, labeled by state, with outcome and the reviewer's reasons |
| FR-16 | Must | Recommend Accept, Peer-to-peer, Resubmit or Appeal with the reason and the overturn rate at external review |
| FR-17 | Must | Draft an appeal letter, peer-to-peer talking points or a list of documents to add, after the clinician picks |
| FR-18 | Must | Synthetic-data-only mode, with no production connector and no way to send to a payer |
| FR-19 | Should | Show policy and authorization freshness, with last-checked time and unavailable-source warnings |
| FR-20 | Should | Coordinator document requests and supervisor escalation with due times |
| FR-21 | Should | Procedural appeal checks: reviewer qualifications, mental health parity, and whether the plan named its guidelines |
| FR-22 | Should | Denial and overturn trends by plan and care type (NY data) |
| FR-23 | Later | Submit through an authorized integration and record receipt |
| FR-24 | Later | Pre-certification and discharge workflows with the same controls |

## 8. Agents and orchestration

The orchestrator is plain TypeScript on the Next.js server, not an LLM. It tracks dependencies, starts the right agents for the case type, routes issues to people or agents, and never makes clinical judgments. Each agent is one Claude call with narrow instructions, typed inputs and outputs, a timeout and a recorded version. That's seven LLM agents.

| Agent | Runs when | Output |
| --- | --- | --- |
| Orchestrator (code) | Intake or any changed input | Which agents run next; issue routing |
| Clinical Documentation | Every case | Candidate facts with passage-level citations; missing or ambiguous records |
| Payer Policy | Every case | Applicable policy and public criteria with version and effective date; each dimension met, unmet or unclear |
| Authorization Tracking | Every case | Reconciles authorization, approved and requested dates; parses denial letters. Flags conflicts without guessing corrections. Mostly code |
| Case Match | Denials, and new requests for objection grounding | 3 to 5 similar real cases chosen from 10 that code prefilters by care type and keywords |
| Insurer Reviewer | Once per run, before approval and on appeal drafts | The 3 likeliest objections, using 4 generic reviewer questions and upheld NY cases, not one insurer's rules |
| Case Assembly and Drafting | After the agents above | The review packet, or the chosen appeal, peer-to-peer points or document list. Source facts kept separate from proposed narrative |
| Independent Quality | Last, every time | Checks support, dates, completeness, conflicts and policy freshness against the original inputs, not just the draft |

Umer's Denial and Appeals Agent is covered by Case Match plus Drafting in denial mode.

**Concurrent review (UR-1042):** Documentation, Policy and Authorization in parallel, then Assembly, then Insurer Reviewer, then Quality, then the clinician. The missing note opens a coordinator task. The date conflict goes back to Authorization Tracking; Assembly and Quality rerun when the record changes. After one bounded rework attempt, unresolved conflicts go to a person.

**Denial:** Authorization parses the letter; Documentation, Policy and Case Match run in parallel; Quality; the clinician picks a next step; Drafting; Insurer Reviewer (one fix round); Quality; clinician approval.

An agent failure or unavailable source produces a visible incomplete state, never a silent pass. Each output records run ID, input versions, time, model version, findings, citations, uncertainty and errors. Diagrams: [agents](https://github.com/umerbashir-del/Umer-Johnathan-JD-repo/blob/main/docs/architecture/agents.md) and [agentic loop](https://github.com/umerbashir-del/Umer-Johnathan-JD-repo/blob/main/docs/architecture/agentic-loop.md).

## 9. Data

**Real appeal decisions (cleaned, in the repo)**

|  | New York | California |
| --- | --- | --- |
| Source | DFS external appeals | DMHC Independent Medical Review |
| Cases | 1,526 | 2,154 |
| Overturned | 58% | 77% |
| Strongest care types | Inpatient detox, inpatient psych | Residential, IOP, PHP |
| Plan name and coverage | Yes | No |

Label every match by state, match within the same care type and prefer the same state, and never pool the overturn rates. Cleaning rules: [data/README.md](https://github.com/umerbashir-del/Umer-Johnathan-JD-repo/blob/main/data/README.md).

**Synthetic sources to write:** the UR-1042 document set (notes for November 1 and 3, the authorization record, the Payer North policy), denial packets A to E, and a one-page public criteria summary (ASAM and LOCUS dimensions and the levels of care each maps to).

**Data model**

| Entity | Core fields |
| --- | --- |
| Case | ID, type, patient pseudonym, service, payer and plan, assigned clinician, due time, status |
| ReviewPeriod | Requested start and end, review point, rationale source, version |
| Authorization | Identifier, status, approved period, source record, last verified time |
| Denial | Reason, denied dates, appeal deadline, source letter, chosen next step |
| Document | ID, type, author, service date, received time, version, content hash |
| EvidenceSpan | Document version, page or section, offsets, excerpt, extraction method |
| Claim | Text, type, packet version, evidence span IDs, author, verification status |
| PolicyRule | Payer, policy ID and version, effective dates, requirement, source span |
| AppealCase | State, year, care level, plan, decision, summary, criteria cited (the NY and CA data) |
| Issue | Type, severity, blocking flag, owner, status, resolution reason and evidence |
| AgentRun | Agent, inputs, outputs, versions, time, status, error |
| PacketVersion | Content, included claim IDs, validation report, hash, created time |
| Approval | Clinician and role, packet hash, acknowledgement, time, status |
| AuditEvent | Actor, action, object and version, time, outcome |

Evidence links survive draft regeneration. When a document changes, its earlier version stays in the audit history and claims that depend on it become stale until rechecked.

## 10. Validation and approval gates

**Automated checks:** required fields; document presence; citations resolve; exact date consistency; requested versus authorized period kept distinct; policy applies and is in effect; unsupported or contradictory claims; stale agent output; packet completeness. Each result is pass, fail or needs human review, with an explanation and the affected fields.

**Human gates**

1. A coordinator verifies newly received documents and administrative corrections.
2. A qualified UR clinician evaluates the clinical representation. They may edit, reject, request more information or escalate.
3. An authenticated clinician approves the final packet version only after blocking checks pass.
4. In production, a separate destination and disclosure check happens before anything is sent.

A clinician may record why an issue is nonblocking where policy allows, but a reason can't replace a required source or bypass a failed access or disclosure check. No agent ever outputs "medical necessity met" or "not met." The Insurer Reviewer's objections are predictions to address, not decisions.

## 11. Security, privacy and cost

**Prototype rules**

- Synthetic data only, watermarked as such. No connection to real EHRs, payer systems or PHI.
- The API key stays on the server. No `NEXT_PUBLIC_` prefix; `.env` files stay out of git.
- Authorization is checked on the server for every request, not only in middleware.
- Parameterized queries or an ORM for every database call.
- Uploaded documents are untrusted. A document could try to steer an agent (prompt injection), so agents return typed JSON that the orchestrator validates, and no agent can send anything. Prompts only include the current case's documents, and we test for cross-case leakage.
- Logs record actions without copying sensitive text.

**Before any real-data pilot (from Umer's PRD):** legal, privacy, security and clinical review; role- and case-based access; strong authentication; encryption; retention and incident-response policies; a documented risk analysis; business associate agreements with every vendor handling ePHI; and the HIPAA minimum-necessary standard.

**42 CFR Part 2:** substance use disorder records may carry stricter consent and disclosure rules than HIPAA. A real system must record each record's origin and restrictions and check consent before agents retrieve, show, export or send it. The 2024 Part 2 rule's compliance date was February 16, 2026. Not every behavioral-health record is a Part 2 record, and counsel must validate the workflow.

**Cost:** $40 of Claude API credit covers every in-app agent run, including testing. A full run is 8 or 9 calls, about 70,000 input and 30,000 output tokens: about $0.03 on Haiku 5.5, $0.45 on Sonnet 5.5 and $0.90 on Opus 5.5. Build and test on Haiku, keep the model name in one config value, cache shared prompts, and save agent outputs during development.

**Performance:** a full run should finish in under 2 minutes, showing progress per agent.

## 12. Acceptance criteria

| Area | Given / then |
| --- | --- |
| Source traceability | Selecting any UR-1042 packet claim opens the cited document version at the supporting passage. A claim with no valid passage is marked unsupported and, if material, blocks approval |
| Missing note | The absent November 2 note shows as a blocking issue that a checkbox can't close. Attaching a valid synthetic note triggers reprocessing and clinician review |
| Date conflict | Requested November 4 to 6 and authorized through November 3 are both shown with sources. Neither is silently changed. Resolution records the verified fact and reason |
| Targeted rework | Correcting an extracted date reruns Assembly and Quality only. Unrelated records keep their versions |
| Policy provenance | Every payer requirement opens its policy passage with version and effective date. A stale or missing policy creates an issue |
| Denial prevention | The Insurer Reviewer shows 3 objections, each tied to chart evidence or a gap, before approval is possible |
| Denial handling | Uploading a synthetic denial letter shows the parsed reason and deadline, 3 to 5 similar real cases labeled by state, and a recommended next step with the overturn rate at external review |
| Holdout | When a denial packet is tested, its own source case never appears in the matches |
| Approval gate | Approval is disabled while any blocking issue, failed check or unsupported material claim remains, and the screen names the blocker |
| Version binding | Approval records clinician, time and packet hash. A material change invalidates it |
| Auditability | A reviewer can reconstruct which sources and agent runs produced the approved packet and who resolved each issue |
| Prototype boundary | Nothing in the MVP can send a packet to a payer or ingest real PHI |
| Clinical boundary | No agent output or label states a final medical-necessity, treatment or coverage decision |

## 13. Metrics and evaluation

Compare against a manual workflow and a single-agent baseline using the same sources and tools, so we can show whether specialized agents and independent review add value. Denial packets are scored against their hidden answer keys.

| Measure | Definition | Target |
| --- | --- | --- |
| Preparation time | Median active minutes from opening a case to a review-ready packet | Lower than manual |
| Source support rate | Material claims with a correct source passage, divided by all material claims | 100% |
| Seeded-issue detection | Missing notes, date conflicts, stale policy and unsupported claims found, divided by those seeded | All UR-1042 issues and packet E's planted gaps |
| False issue burden | Non-actionable flags per case | Report it; keep it low |
| Objection accuracy | The real reviewer's main reason appears in the Insurer Reviewer's top 3 | 4 of 5 packets |
| Recommendation accuracy | Strong appeal for overturned packets A, C and D; weak or fix-first for upheld B and E | 5 of 5 |
| Match quality | Matches in the same care type and labeled by state | 100% |
| Approval integrity | Approvals bound to a validated, unchanged packet version | 100% |
| Agent reliability | Completion, failure, retry and escalation rates by agent | Report it |
| Cost and time per run | On the demo model | Under $1 and 2 minutes |

Faster approval alone isn't success if source accuracy, issue detection or clinician confidence gets worse.

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| Fluent but unsupported clinical narrative | Passage-level citations, unsupported-claim blocking, independent quality review, clinician approval |
| Wrong policy or authorization date | Version and effective-date display, source verification, no silent normalization |
| Automation bias | Original evidence beside the draft, agent content labeled, active review of changes required |
| Alert fatigue | Severity and ownership rules; measure false flags; don't repeat an issue across runs |
| Overturn rates read as a chance of winning | Always label them "overturn rate at external review," per state, never pooled |
| Thin matches for some care types | Fall back to the other state and show "few similar cases" |
| Sensitive information disclosure | Case and role access, purpose-limited prompts, Part 2 checks before any real data |
| Prompt injection in an uploaded document | Typed, validated JSON outputs; agents can't send anything |
| Rework loops or agent disagreement | Bounded retries, typed issue routing, human escalation |
| Testing burns the $40 | Build on Haiku, cache prompts, save agent outputs |
| Scope too big for the timeline | Concurrent review first; denial scene second; P1 items cut first |
| Prototype mistaken for clinical software | Synthetic watermark, no submission path, clear demo status |

## 15. Milestones, demo and open questions

| Milestone | Deliverable | Exit gate |
| --- | --- | --- |
| M1. Synthetic foundation | UR-1042 documents, policy and authorization; denial packets A to E; criteria summary; NY and CA data in SQL; queue, case states, audit events | UR-1042 and its two issues load consistently |
| M2. Evidence workspace | Summary and Evidence screens, versioned claims, passage navigation | Every material claim is source-linked or flagged |
| M3. Agents and issues | Orchestrator and the seven agents on Haiku, Issues screen, targeted reruns, quality checks | Missing-note and date-conflict scenarios behave as specified |
| M4. Approval | Packet preview, validation report, approval gate, version-bound approval | Acceptance criteria pass with no submission path |
| M5. Denials | Denial view, Case Match, recommendation, drafting, Insurer Reviewer on drafts | Denial and holdout criteria pass |
| M6. Evaluation and demo | Scores against answer keys and a single-agent baseline; switch to the demo model; slides | Metrics reported with their limits; both scenes rehearsed |

**Demo script**

1. **Concurrent review and prevention (UR-1042):** the workspace flags the missing note and the date conflict, the Insurer Reviewer predicts objections, the clinician resolves the issues, and approval unlocks.
2. **Denial:** a denied detox stay. The app parses the letter, shows overturned case 201908-120030 next to upheld 201908-119701, recommends a next step and drafts the appeal around the ASAM dimensions. The clinician approves it.

**Open questions**

- **Operator:** we assume a provider-side UR team, which matches Ritten. Confirm.
- Who owns which agents and screens, and what is the presentation date?
- Which model runs the live demo, Sonnet 5.5 or Opus 5.5?
- Which documents are "required" for each review type, and which issues may a clinician close with a written reason instead of a source?
- For a later pilot: credential rules for approvers, the authoritative authorization source and how fresh it must be, Part 2 labeling when the source system can't supply it, and the quality bar versus manual and single-agent baselines.

**Product decision for the MVP:** one complete, inspectable concurrent review for UR-1042, plus one denial flow grounded in real appeal data. Agents prepare and verify; a qualified clinician stays responsible for every clinical statement and approval.
