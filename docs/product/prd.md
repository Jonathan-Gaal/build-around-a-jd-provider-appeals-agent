# PRD: Behavioral-health UR workspace and appeals agent

Nov 4, 2026 · Jonathan Gaal and Umer Bashir · [Live doc](https://claude.ai/artifact/Dg3c6wvHQgMbqFZrSY4RnV)

## 1. Summary and vision

The product gives behavioral-health UR clinicians a workspace that assembles a concurrent-review packet, shows the source behind every material statement, flags missing or conflicting information, and makes the clinician's review and approval explicit.

The workspace should answer three questions quickly: **What needs my attention? What evidence supports this statement? What action should I take?**

Agents gather, extract, assemble and check. They never decide medical necessity, approve care or send anything on a clinician's behalf.

**The MVP is one case, end to end: UR-1042.** Denials, appeals and the rest of the UR cycle reuse the same evidence, issue and approval controls. They're designed but come later (section 3). Two builders are building this in the window set out below.

### Build window

| | |
| --- | --- |
| **Build** | Thursday Nov 5 to Saturday Nov 7, 2026: three build days for the MVP |
| **Buffer** | Sunday Nov 8 to Tuesday Nov 10: fixes, then Should items in order (section 7) |
| **Rehearsal** | Wednesday Nov 11 |
| **Presentation** | Thursday Nov 12, 2026 |

Everything marked **Must** fits the three build days. Nothing marked Should starts until every Must acceptance criterion in section 12 passes.

### Example of success

> **Concurrent review.** In fictional case UR-1042, a UR clinician opens a prepared concurrent-review packet. The workspace has already flagged the missing November 2 progress note and the gap between the requested dates (Nov 4–6) and the authorized dates (Nov 1–3). The clinician checks each draft claim against its source passage, attaches the late note, records the verified dates, and approves that exact packet version.
>
> **What never happens automatically:** a medical-necessity decision, a clinical determination or a submission to the payer.

### Example of failure

> **What failure looks like in UR-1042:**
> - The clinician opens a polished packet that reads well.
> - It quotes a November 2 progress note that doesn't exist.
> - It quietly changes the request to match the authorized Nov 1–3 dates.
> - It says the patient "meets medical necessity criteria."
> - An agent timed out, and the run shows as complete.
> - Approve is enabled. The clinician trusts the draft and signs it.
>
> Every one of these is a failure even if the demo looks smooth. Each maps to a guard:
> - quote verification in code (FR-04),
> - no silent date changes (FR-07),
> - the clinical boundary (section 3),
> - visible failed runs (FR-26), and
> - the approval gate (FR-11).
>
> Section 12 tests each one.

|  |  |
| --- | --- |
| **Version** | 3.0. Scope cut to UR-1042 after review on Nov 4 |
| **Team** | Jonathan Gaal (backend: agents, data, API) and Umer Bashir (frontend: screens) |
| **Built around** | [Ritten, Authorization (UR) Specialist](https://www.ritten.io/jobs/authorization-ur-specialist) |
| **Stack** | Next.js, TypeScript, React, Postgres, Claude API |
| **Data** | Synthetic patients only. 3,680 real NY and CA appeal decisions are in the repo for the later denial flow |
| **Repo** | [Umer-Johnathan-JD-repo](https://github.com/umerbashir-del/Umer-Johnathan-JD-repo) |

## 2. Users and problem

**The MVP serves one user: the UR clinician.** This is the JD's UR specialist. They verify the draft against source records, use clinical judgment, correct or reject statements, and approve a specific packet version. Every MVP screen and requirement serves them.

The other roles in a UR team are named so the design leaves room for them. None has an account, screen or requirement in the MVP.

| Role | What they do on a real UR team | In the MVP |
| --- | --- | --- |
| UR coordinator | Chases missing documents from intake and clinical staff, fixes administrative records such as authorization numbers, tracks payer deadlines | Not a user. The clinician attaches the late note themselves. Coordinator requests (FR-20) are later |
| UR manager or supervisor | Reassigns work, watches overdue cases, handles escalations, reviews denial trends by plan | Later: escalation (FR-20), trends (FR-22), audit review (US-17) |
| Submission staff | Sends an approved packet through the payer's channel and records the receipt | Later (FR-23). The MVP has no submission path |
| Administrator and privacy officer | Configures access, retention, audit review and disclosure rules | Before any real-data pilot only |

**Where the persona comes from.** It is drawn from the Ritten JD and public descriptions of UR work. We haven't interviewed UR clinicians. Treat it as an assumption to check, not as user research.

**The problem.** Concurrent reviews require recent notes, payer requirements, service dates and existing authorizations to be reconciled under a deadline, and these sit in different systems. An unsupported statement, a missing note or a date conflict is hard to spot in a polished draft, and each one invites a denial.

*Assumed, not measured:* we believe assembling and checking a concurrent-review packet takes a clinician much longer by hand than reviewing a prepared one, and that each denial adds more work (reading the letter, finding evidence, writing the appeal, tracking the deadline). We have no published time study to cite. Section 13 measures our own preparation time for UR-1042 against a manual walk-through, and we report it as one case, not a general result.

The Ritten JD names the whole cycle: prior authorizations, concurrent reviews, denials, appeals, peer-to-peer reviews, denial-trend tracking and denial prevention. The MVP covers concurrent review only.

### JD coverage

Gaps are listed on purpose so the demo doesn't imply full coverage. Full table: [docs/research/job-descriptions.md](../research/job-descriptions.md).

| JD duty | How the app covers it | Stories | Status |
| --- | --- | --- | --- |
| Concurrent reviews and expiration tracking | Deadline queue, UR-1042 end to end, authorized vs requested periods | US-01–03, US-09 | MVP |
| Auth records and unit limits | Dates compared in code against the request | US-06 | MVP |
| Find authorization gaps | Missing notes and date conflicts become blocking issues | US-05, US-06 | MVP |
| First line of defense against denials | Quality lists the plan's 3 likely objections before approval | US-07 | Should |
| Initial authorizations with ASAM documentation | ASAM/LOCUS documentation labels (FR-06); pre-cert workflow later (FR-24) | US-04, US-18 | Should / Later |
| Payer contact, peer-to-peer, appeals | Denial parsing, similar real cases, next step, drafted appeal | US-10–13, US-19 | Later (one denial demo if time allows) |
| Report denial trends | Trends by plan and care type (NY data) | US-16 | Later |
| Coordinate with intake and clinical | Coordinator document requests with due times | US-15 | Later |
| Retro-authorization requests | Not covered | none | Gap |
| Clean claims with billing; ICD-10 checks | Not covered | none | Gap |
| Commercial, Medicaid, Medicare across states | Synthetic commercial plan only in the MVP | none | Gap in MVP |

### User stories

Each story's JD duty, FRs and acceptance criterion are in [user-stories.md](user-stories.md). Story IDs name e2e tests.

**MVP (Must)**

- **US-01** Cases sorted by review deadline, so no authorization lapses.
- **US-02** Requested and authorized periods, deadline and a draft packet ready on open.
- **US-03** Every draft statement opens its source passage.
- **US-05** Missing notes are blocking issues a checkbox can't close.
- **US-06** Auth-record vs request date conflicts shown side by side, never silently changed.
- **US-08** Correct a statement or attach a late note, and the packet is rebuilt and rechecked.
- **US-09** Approve one exact packet version; blocked until blocking issues are resolved.

**Should, in build order:** US-07 the plan's 3 likely objections · US-04 ASAM or LOCUS documentation labels.

**Later:** US-10 to US-13 denial handling (one denial demo if time allows) · US-14 procedural appeal checks · US-15 coordinator requests · US-16 denial trends · US-17 audit reconstruction for a manager · US-18 initial authorization prep · US-19 payer portal submission · US-20 appeal-chain tracking.

## 3. Goals, scope and non-goals

**MVP goals**

1. Complete one synthetic concurrent review (UR-1042) from a prepared packet to a clinician-approved packet version.
2. Make every material claim traceable to a source passage, or visibly mark it unsupported.
3. Surface UR-1042's two seeded problems, the missing note and the date conflict, as blocking issues the clinician resolves with evidence.
4. Require the clinician to approve the exact packet version, and record who approved what and when.

**MVP scope:** a case queue; a case workspace with Summary, Evidence, Issues and Approval screens; the UR-1042 document set; three LLM agents and a code orchestrator; a simple approval gate bound to a packet hash; an audit row for every state change; one demo clinician account.

**Should (only after every Must passes, in this order):** likely objections (FR-08), criteria documentation labels (FR-06), targeted reruns (FR-10), retrying only failed agents (FR-26b).

**Later (designed, not built for Nov 12):** the denial flow (FR-14 to FR-17), appeal-chain tracking (FR-25), parsing every payer letter type (FR-14), denial trends (FR-22), coordinator and supervisor workflows (FR-20), policy freshness (FR-19), procedural appeal checks (FR-21), the single-agent baseline comparison, denial packets B to E, and the full audit history (FR-13b). If the buffer days allow, we show **one** denial demo on packet A. It isn't promised.

**Non-goals**

- Any agent decision on medical necessity, coverage or treatment.
- Real patient data. Real PHI would need privacy, security and legal review and BAAs with every vendor.
- Payer submission, EHR writeback or automated clinician signatures.
- Insurers' proprietary criteria (InterQual, MCG). We use public criteria: ASAM, LOCUS, LOCADTR.
- Medicare, pharmacy, surgery, TMS or experimental-treatment cases.
- Predicting a chance of winning an appeal.
- Pre-certification and discharge workflows.

## 4. Demo case

Everything here is fictional and marked synthetic. Agents may only state clinical facts that appear in the synthetic source set; they may not fill gaps with plausible details.

**UR-1042, concurrent review**

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

The demo runs on a fixed server-side clock of November 3, 2026, labeled on screen, so UR-1042 isn't shown as nine days overdue on November 12. Fixture dates aren't edited.

**Later: denial packets.** Five synthetic packets (A to E) built from real NY appeal cases, with hidden answer keys, are already in the repo's `fixtures/`. The optional denial demo uses packet A only. Packet details: [synthetic patients doc](https://github.com/umerbashir-del/Umer-Johnathan-JD-repo/blob/main/docs/data/synthetic-patients.md).

## 5. User journey and case states

**Concurrent review (UR-1042)**

1. **Open the queue.** Cases are sorted by deadline. UR-1042 shows "Needs review" with two blocking issues.
2. **Open Summary.** Review period, authorization, draft packet, agent status and blocking issues.
3. **Verify evidence.** Select a statement to see its source passage, with document date, author and version.
4. **Resolve issues.** Attach the late November 2 note, which rebuilds and rechecks the packet. Record the verified dates and the reason for the date conflict. A checkbox alone can't close either issue.
5. **Review approval.** Inspect the final packet and validation result. Approve is available only when no blocking issue, unsupported material claim or failed run remains, and the screen names any blocker.
6. **Approve the version.** The system records the clinician, time, packet version and hash. The case becomes "Approved"; nothing is sent.
7. **Reopen on change.** Any later change to a source, a date or the packet content invalidates the approval and returns the case to review.

**States (MVP):** Processing → Needs review → Ready for approval → Approved. A failed run shows as Incomplete. An invalidated approval returns to Needs review. Payer-response and appeal states come with the later denial flow.

## 6. Screens

Owned by Umer. Desktop layout: case navigation and status on the left, working content in the center, the source viewer and agent findings on the right. The header always shows the case ID, case type, due time and time zone, packet version, status and number of blocking issues.

| Screen | Shows | Actions |
| --- | --- | --- |
| **Queue** | Assigned cases with deadline, status, issue count and last update | Open a case |
| **Summary** | Case facts; requested and authorized periods shown separately; deadline; draft narrative; agent status; issue banner | Open a claim's source; go to an issue; edit a statement |
| **Evidence** | Document list and viewer with the cited passage highlighted; metadata; claim-to-source map. Labels quotes, clinician text and agent synthesis differently | Jump from a claim to its passage; flag a wrong citation |
| **Issues** | Issue cards with severity, source, effect on approval and allowed resolutions | Attach a document; record verified dates with a reason |
| **Approval** | Read-only preview of the exact packet version; validation result; open blockers | Return for editing, or approve when eligible. Shows why approval is blocked |

Content is always labeled as agent-prepared, source-verified, clinician-edited or clinician-approved. The Denial screen is later.

## 7. Functional requirements

**One cut line.** Must is the MVP and fits the three build days. Should items are built only after every Must acceptance criterion passes, in the order listed. Later items aren't built for November 12. If time runs short, the Should list is cut from the bottom up; no Must is cut.

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-01 | Must | Load UR-1042 with separate patient, service, payer, authorization, deadline and document records |
| FR-02 | Must | Show an assigned queue with deadline, status, issue count and last update |
| FR-03 | Must | Sign in with one demo clinician account; check on the server, for every request, that the user may see that case |
| FR-04 | Must | Produce a versioned draft packet whose material claims link to source passages, verified in code, or carry an "unsupported" flag |
| FR-05 | Must | Show source metadata and the original passage for each citation. Never alter original documents |
| FR-07 | Must | Detect the missing note and the date conflict in code, as typed blocking issues with resolution evidence |
| FR-09 | Must | Let the clinician edit or reject draft wording without changing the source record |
| FR-11 | Must | Block approval for missing required documents, unresolved blocking issues, unsupported material claims, an incomplete run, or a packet changed since review |
| FR-12 | Must | Record approval against a packet version and hash; any later change invalidates it |
| FR-13 | Must | Write an audit row for every case state change, issue resolution and approval |
| FR-18 | Must | Synthetic-data-only mode, with no production connector and no way to send to a payer |
| FR-26 | Must | Give every agent call a timeout and one retry. Show a failed or timed-out agent by name, keep completed results, and block approval until a run completes |
| FR-08 | Should 1 | The Quality agent also lists the plan's 3 most likely objections, with the evidence that would answer each |
| FR-06 | Should 2 | Label each LOCUS dimension documented, not found or unclear, with the supporting quote. Labels describe the record, not whether criteria are met |
| FR-10 | Should 3 | After a correction or new document, rerun only the affected agents. Until then, the whole three-call run reruns |
| FR-26b | Should 4 | Retry only the failed agents, within a per-run call and token budget |
| FR-13b | Later | Full append-only audit history of access, extraction, edits, validation and export |
| FR-14 | Later | Parse every payer letter type into dates, reason, deadlines and decision, with a verified quote per field. The optional denial demo parses one denial letter only |
| FR-15 | Later | Show 3 to 5 similar real appeal cases, labeled by state, with outcome and the reviewer's reasons |
| FR-16 | Later | Recommend Accept, Peer-to-peer, Resubmit or Appeal with the reason and the overturn rate at external review |
| FR-17 | Later | Draft an appeal letter, peer-to-peer talking points or a list of documents to add |
| FR-19 | Later | Policy and authorization freshness |
| FR-20 | Later | Coordinator document requests and supervisor escalation |
| FR-21 | Later | Procedural appeal checks |
| FR-22 | Later | Denial and overturn trends by plan and care type |
| FR-23 | Later | Submit through an authorized integration and record receipt |
| FR-24 | Later | Pre-certification and discharge workflows |
| FR-25 | Later | Track payer status and the appeal chain |

## 8. Agents and orchestration

The orchestrator is plain TypeScript on the Next.js server, not an LLM. **The MVP uses three LLM agents.** Everything else is deterministic code, so it's free, fast and testable.

| Step | Kind | What it does | Calls per run |
| --- | --- | --- | --- |
| Orchestrator | Code | Runs the agents in order, routes issues, reruns after a change | 0 |
| Date coverage and authorization check | Code | Finds days with no progress note; compares requested and authorized periods | 0 |
| Quote verification | Code | Confirms every quote appears in its cited document | 0 |
| Approval gate | Code | Computes blockers and the packet hash | 0 |
| **Clinical Documentation** | LLM | Candidate facts with passage-level quotes; ambiguous records | 1 |
| **Case Assembly and Drafting** | LLM | The review packet, built only from verified facts, each sentence citing its facts | 1 |
| **Independent Quality** | LLM | Checks the draft against the original documents, not just the draft, for unsupported claims, wrong dates and omissions. With FR-08, it also lists likely objections | 1 |
| **Total** | | | **3** |

**Run order:** the code checks and Clinical Documentation run first, then Drafting, then Quality, then the clinician. Attaching the late note or correcting a date reruns all three agents (about three calls), until targeted reruns (FR-10) are built.

**What moved to code or later.** Authorization Tracking is now code: comparing dates doesn't need a model. Payer Policy's criteria check is Should 2 (FR-06). Insurer Reviewer folds into Quality as Should 1 (FR-08). Case Match belongs to the later denial flow. Each agent's design is in [agent-specs.md](../architecture/agent-specs.md).

**Timeouts and failure.** Each call has a timeout and one retry, and agents can't trigger more calls. If an agent fails or times out, the run shows as Incomplete with the agent's name and the reason, keeps the results that succeeded, and blocks approval. Nothing is shown as complete when it isn't.

Each output records run ID, input versions, time, model version, findings, quotes and errors.

## 9. Data

**MVP:** the UR-1042 document set in `fixtures/ur-1042/`: progress notes for November 1 and 3, the late November 2 note, the authorization record, the request and the Payer North policy.

**Data model (MVP)**

| Entity | Core fields |
| --- | --- |
| Case | ID, type, patient pseudonym, service, payer and plan, assigned clinician, due time, status |
| ReviewPeriod | Requested start and end, review point, source document |
| Authorization | Identifier, status, approved period, source record |
| Document | ID, type, author, service date, received time, version, content hash |
| Claim | Text, packet version, quoted passages, verification status |
| Issue | Type (missing document or date conflict), blocking flag, status, resolution reason and evidence |
| AgentRun | Agent, inputs, outputs, model version, time, status, error |
| PacketVersion | Content, included claim IDs, validation result, hash, created time |
| Approval | Clinician, packet hash, time, status |
| AuditEvent | Actor, action, object and version, time |

**Later:** PayerLetter, Appeal, Submission and AppealCase for the denial flow; PolicyRule and EvidenceSpan detail for criteria labels. The full schema is in [database-schema.md](../architecture/database-schema.md).

**Real appeal decisions (in the repo, used later):** 1,526 NY decisions from the [NY DFS external appeal search](https://www.dfs.ny.gov/public-appeal/search) and 2,154 CA decisions from the [CA DMHC Independent Medical Review data](https://data.chhs.ca.gov/dataset/b79b3447-4c10-4ae6-84e2-1076f83bb24e), 2019 to 2026. Every match is labeled by state, and NY and CA overturn rates are never pooled. Cleaning rules: [data/README.md](https://github.com/umerbashir-del/Umer-Johnathan-JD-repo/blob/main/data/README.md).

## 10. Validation and approval gate

**Automated checks (code):** every quote appears in its cited document; a progress note exists for each day of the stay so far; requested and authorized periods are kept distinct and both shown; every agent in the run completed; the packet hasn't changed since review. Each result is pass or fail, with an explanation.

**Required documents for UR-1042:** a progress note for each day of the stay so far, the authorization record and the request. A missing note can only be closed by attaching it. The date conflict can be closed with the verified dates, a written reason and the source checked.

**Human gate:** the clinician evaluates the clinical representation, may edit or reject statements, and approves the final packet version only after the blocking checks pass. No agent ever outputs "medical necessity met" or "not met."

## 11. Security, privacy and cost

**Prototype rules**

- Synthetic data only, watermarked as such. No connection to real EHRs, payer systems or PHI.
- The API key stays on the server. No `NEXT_PUBLIC_` prefix; `.env` files stay out of git.
- Authorization is checked on the server for every request, not only in middleware.
- An ORM for every database call; no string-built SQL.
- Documents are untrusted. A document could try to steer an agent (prompt injection), so agents return typed JSON that code validates, agent output can add blockers but never remove them, and no agent can send anything. Prompts include only the current case's documents.
- Logs record actions without copying sensitive text.

**Before any real-data pilot (from Umer's PRD):** legal, privacy, security and clinical review; role- and case-based access; strong authentication; encryption; retention and incident-response policies; a documented risk analysis; business associate agreements with every vendor handling ePHI; the HIPAA minimum-necessary standard; and 42 CFR Part 2 consent checks for substance-use records.

**Cost:** $40 of Claude API credit covers every in-app agent run, including testing. The app stops live calls before the limit: ordinary use stops at $26, the last $10 is reserved for rehearsal and the demo, and nothing runs past $36. The MVP run is three calls. All runs use Haiku 5.5, which the earlier estimate put at about $0.03 for a five- to six-call run, so the MVP run should cost less. We may switch the demo to Sonnet 5.5, a one-line config change. Saved agent outputs are replayed in tests, so most testing costs nothing.

**Performance:** a full run should finish in under 2 minutes, showing progress per agent.

## 12. Acceptance criteria

**Must (the MVP passes all of these)**

| Area | Given / then |
| --- | --- |
| Source traceability | Selecting any UR-1042 packet claim opens the cited document version at the supporting passage. A claim with no valid passage is marked unsupported and, if material, blocks approval |
| Missing note | The absent November 2 note shows as a blocking issue that a checkbox can't close. Attaching the synthetic note reruns the agents and clears the issue only when the note is present |
| Date conflict | Requested November 4 to 6 and authorized November 1 to 3 are both shown with sources. Neither is silently changed. Resolution records the verified dates, a reason and the source checked |
| Approval gate | Approval is disabled while any blocking issue, unsupported material claim or incomplete run remains, and the screen names the blocker |
| Version binding | Approval records the clinician, time and packet hash. A later change to a source, date or packet content invalidates it |
| Failed run | If an agent times out, the run shows Incomplete with that agent's name, keeps completed results and blocks approval |
| Audit | Every state change, issue resolution and approval for UR-1042 has an audit row with actor, action and time |
| Prototype boundary | Nothing in the MVP can send a packet to a payer or ingest real PHI |
| Clinical boundary | No agent output or label states a medical-necessity, treatment or coverage decision |

**Should:** Denial prevention: Quality shows 3 objections, each tied to chart evidence or a gap, before approval. Criteria labels: each LOCUS dimension shows a label and its quote. Targeted rework: correcting an extracted date reruns Drafting and Quality only.

**Later:** denial handling, holdout, letter parsing and appeal tracking criteria move with the denial flow.

## 13. Metrics and evaluation

Measured on UR-1042 only. One case is a demo, not a study: we report the results and don't claim they generalize.

| Measure | Definition | Target |
| --- | --- | --- |
| Source support rate | Material claims with a correct source passage, divided by all material claims | 100% |
| Seeded-issue detection | UR-1042's two seeded issues found | Both |
| False issues | Flags on UR-1042 that aren't real problems | Report it; 2 or fewer |
| Approval integrity | Approvals bound to a validated, unchanged packet version | 100% |
| Preparation time | Active minutes from opening UR-1042 to a review-ready packet, against a manual walk-through of the same documents | Report both |
| Cost and time per run | On the demo model | Under $1 and 2 minutes |

**Later:** comparison with a single-agent baseline, objection and recommendation accuracy against the denial packets' answer keys, and match quality.

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| Fluent but unsupported clinical narrative | Quote verification in code, unsupported-claim blocking, independent Quality agent, clinician approval |
| Wrong authorization date | Both periods shown with sources, no silent normalization, resolution needs the verified dates and source |
| Automation bias | Original evidence beside the draft, agent content labeled |
| Prompt injection in a document | Typed, validated JSON outputs; agent output can't remove blockers; agents can't send anything |
| Testing burns the $40 | Haiku for every run, replayed outputs in tests, the app's spend stop |
| Scope too big for the window | One case and three agents. Must fits three build days. Should items are cut from the bottom up; no Must is cut |
| The frontend and backend drift apart | One API contract both tracks build against, agreed on Nov 5 |
| Prototype mistaken for clinical software | Synthetic watermark, no submission path, clear demo status |

## 15. Milestones, demo and decisions

| Day | Milestone | Backend (Jonathan) | Frontend (Umer) | Exit gate |
| --- | --- | --- | --- | --- |
| Nov 5 | M1. Foundation | Next.js scaffold (done Nov 4), database and schema, UR-1042 seed, demo sign-in with the server-side case check, audit helper | Queue screen and case layout, against the API contract | UR-1042 loads with its two issues |
| Nov 6 | M2. Agents and evidence | Harness limits, the three agents, orchestrator, issues computed in code | Summary and Evidence screens with passage highlighting | Every material claim is source-linked or flagged |
| Nov 7 | M3. Issues and approval | Issue resolution, approval gate, version-bound approval, rerun after the late note | Issues and Approval screens | Every Must criterion in section 12 passes |
| Nov 8–10 | M4. Hardening and Should | Fixes, then Should 1 to 4 in order; optional denial demo on packet A | Polish, failed-run and blocked states | Musts still pass |
| Nov 11 | M5. Rehearsal | Switch the demo model if needed | Demo walk-through | Demo rehearsed twice |

**Demo script**

1. The queue shows UR-1042 with two blocking issues. Approve is disabled and names both.
2. The clinician opens a draft claim and sees its source passage highlighted.
3. The clinician attaches the late November 2 note. The agents rerun and the missing-note issue clears.
4. The clinician records the verified dates and reason for the date conflict.
5. Approve unlocks. The clinician approves; the version and hash are recorded.
6. Editing one statement afterward invalidates the approval.
7. Optional, if built: a denied detox stay on packet A.

**Decisions (resolved Nov 4)**

| Question | Decision |
| --- | --- |
| Operator | A provider-side UR team, which matches Ritten |
| Owners | Backend (agents, data, API) is Jonathan's; frontend (screens) is Umer's |
| Presentation date | November 12, 2026 |
| Demo model | Haiku 5.5, with Sonnet 5.5 as a one-line switch if rehearsal shows we need it |
| Required documents and closure rules | Section 10 |

**Open, for a later pilot only:** credential rules for approvers, the authoritative authorization source and how fresh it must be, Part 2 labeling, and the quality bar against manual and single-agent baselines.

**Product decision for the MVP:** one complete, inspectable concurrent review for UR-1042 with three agents. Agents prepare and verify; a qualified clinician stays responsible for every clinical statement and approval.
