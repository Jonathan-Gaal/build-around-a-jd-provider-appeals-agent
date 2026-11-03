# User stories

Each story is written from the point of view of someone doing the job in the [Ritten Authorization (UR) Specialist JD](../research/job-descriptions.md). It names the JD duty it serves, the PRD requirements (FR) that build it, and the PRD acceptance criterion (AC) that proves it works. IDs are stable: reference them in issues, PRs and e2e test names (`e2e/us-05-missing-note.spec.ts`).

**Personas**

- **UR specialist.** This is the person in the JD and the primary user. In the PRD they are the UR clinician who verifies and approves.
- **UR coordinator.** Chases documents and fixes administrative records.
- **UR manager.** Watches deadlines and denial trends, and reports to leadership.

**Priority** follows the PRD:

- **MVP** is built for the demo.
- **Should** is built if time allows.
- **Later** is documented only.

## Concurrent review (UR-1042)

| ID | Story | JD duty | FRs | Proven by (PRD AC) | Priority |
| --- | --- | --- | --- | --- | --- |
| US-01 | As a UR specialist, I want my cases sorted by review deadline with status and open-issue count, so that no authorization expires and leaves a coverage gap. | Manage concurrent reviews and track expiration dates | FR-01, FR-02, FR-03 | Queue shows UR-1042 as "Needs review" with 2 issues | MVP |
| US-02 | As a UR specialist, I want the requested and authorized periods, the deadline and a draft packet ready when I open a case, so that I start from a prepared review instead of a blank page. | Manage concurrent reviews | FR-04, FR-19 | Date conflict | MVP |
| US-03 | As a UR specialist, I want every statement in the draft to open its source passage, so that I can verify it before I put my name on it. | Medical-necessity documentation | FR-04, FR-05 | Source traceability | MVP |
| US-04 | As a UR specialist, I want each ASAM or LOCUS dimension labeled documented, not found or unclear with the supporting quote, so that I can see where the documentation is weak against the criteria. | Medical-necessity documentation (ASAM) | FR-06 | Policy provenance | MVP |
| US-05 | As a UR specialist, I want missing notes flagged as blocking issues that a checkbox can't close, so that I never submit a review with a gap in the record. | Identify authorization gaps | FR-07, FR-11 | Missing note | MVP |
| US-06 | As a UR specialist, I want conflicts between the auth record and the request (dates, units) shown side by side with sources, so that the authorization record stays accurate and nothing is silently changed. | Maintain authorization records, monitor unit limits | FR-07, FR-19 | Date conflict | MVP |
| US-07 | As a UR specialist, I want the three objections the plan's reviewer is most likely to raise, each with the evidence that answers it, before I approve, so that I can prevent the denial instead of appealing it. | First line of defense against denials | FR-08 | Denial prevention | MVP |
| US-08 | As a UR specialist, I want to correct a draft statement or attach a late note and have only the affected agents rerun, so that a fix doesn't cost me a full reprocess or change unrelated records. | Keep documentation complete | FR-09, FR-10 | Targeted rework | MVP |
| US-09 | As a UR specialist, I want to approve one exact packet version, with approval blocked until every blocking issue is resolved, so that what I signed is what goes out. | Submit authorizations with documentation | FR-11, FR-12, FR-13 | Approval gate, Version binding | MVP |

## Denials and appeals

| ID | Story | JD duty | FRs | Proven by (PRD AC) | Priority |
| --- | --- | --- | --- | --- | --- |
| US-10 | As a UR specialist, I want every payer letter (approval, partial approval, denial, request for information, appeal decision) turned into its dates, units, reason and deadlines, each with the quote it came from, so that I never miss a deadline or misread what was approved. | Maintain authorization records; support denial appeals | FR-14 | Denial handling | MVP |
| US-20 | As a UR specialist, I want each case's appeal chain (peer-to-peer, internal, external) with status, deadline, what we sent and the decision, so that I always know where every appeal stands and what's due next. | Peer-to-peer reviews and appeals; track denials | FR-25 | Appeal tracking | MVP |
| US-11 | As a UR specialist, I want 3 to 5 similar real appeal decisions, won and lost, labeled by state, so that I know which arguments have worked at external review. | Support denial appeals | FR-15 | Denial handling, Holdout | MVP |
| US-12 | As a UR specialist, I want a recommended next step (Accept, Peer-to-peer, Resubmit or Appeal) with its reason and the external-review overturn rate, so that I spend time on the denials worth fighting. | Peer-to-peer reviews and appeals | FR-16 | Denial handling | MVP |
| US-13 | As a UR specialist, I want an appeal letter or peer-to-peer talking points drafted from the chart, then challenged once by the insurer-reviewer agent, so that I go into the appeal or call prepared. | Peer-to-peer reviews and appeals | FR-17, FR-08 | Denial prevention, Source traceability | MVP |
| US-14 | As a UR specialist, I want procedural checks on the denial (reviewer qualifications, parity, named guidelines), so that I can raise procedural grounds as well as clinical ones. | Support denial appeals | FR-21 | (none yet) | Should |

## Coordination and oversight

| ID | Story | JD duty | FRs | Proven by (PRD AC) | Priority |
| --- | --- | --- | --- | --- | --- |
| US-15 | As a UR coordinator, I want to request a missing document from the clinical team with a due time, so that the gap is closed before the review deadline. | Coordinate with intake and clinical teams | FR-20 | Missing note | Should |
| US-16 | As a UR manager, I want denial and overturn trends by plan and level of care, so that I can report denial trends to leadership. | Report denial trends to leadership | FR-22 | (none yet) | Should |
| US-17 | As a UR manager, I want to see which sources and agent runs produced an approved packet and who resolved each issue, so that I can audit any review. | Maintain accurate records | FR-13 | Auditability | MVP |

## Later

| ID | Story | JD duty | FRs | Priority |
| --- | --- | --- | --- | --- |
| US-18 | As a UR specialist, I want an initial authorization request for IOP, PHP, residential or detox prepared with ASAM documentation, so that admissions start authorized. | Obtain and submit initial authorizations | FR-24 | Later |
| US-19 | As a UR specialist, I want an approved packet submitted through the payer's portal with the receipt recorded, so that I don't re-key it. | Main contact with payer UR departments | FR-23 | Later |

## Boundaries every story inherits

- Agents never decide medical necessity, coverage or treatment.
- Nothing is sent to a payer.
- Data is synthetic only.

See the PRD's Clinical boundary and Prototype boundary criteria.
