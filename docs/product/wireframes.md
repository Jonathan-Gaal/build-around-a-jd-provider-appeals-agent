# Wireframes

Low-fidelity layouts for each screen. Behavior is specified in the [PRD](prd.md), sections 5 and 6. Every case screen shares the same header and three-pane layout; on small screens the panes become tabs.

## Shared case header

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ UR-1042 · Concurrent review · Inpatient BH   Due Nov 3, 5:00 PM ET   v3      │
│ Status: Needs review        ⛔ 2 blocking issues          SYNTHETIC DATA     │
├────────────┬───────────────────────────────────────────┬─────────────────────┤
│ Summary    │                                           │ Source viewer /     │
│ Evidence   │            (screen content)               │ agent findings      │
│ Issues (2) │                                           │                     │
│ Denial     │                                           │                     │
│ Approval   │                                           │                     │
│ History    │                                           │                     │
└────────────┴───────────────────────────────────────────┴─────────────────────┘
```

## Queue

```
My cases                                         [ Filter: status ▾ ]
┌─────────┬──────────────────────────┬──────────────┬──────────────┬────────┐
│ Case    │ Patient · Level of care  │ Due          │ Status       │ Issues │
├─────────┼──────────────────────────┼──────────────┼──────────────┼────────┤
│ UR-1042 │ Patient A · Inpatient BH │ Today 5:00PM │ Needs review │ ⛔ 2   │
│ DN-A    │ Patient B · Detox        │ Nov 10       │ Denied       │ 1      │
└─────────┴──────────────────────────┴──────────────┴──────────────┴────────┘
```

## Summary

```
Authorized  Nov 1 – 3  (auth record ↗)     Requested  Nov 4 – 6  (request ↗)
⚠ Requested period extends past authorization — verify            [Go to issue]

Agents   ✓ Documentation  ✓ Policy  ✓ Authorization  ✓ Assembly
         ✓ Insurer Reviewer  ✓ Quality        last run 4:12 PM   [Rerun ▾]

Draft packet                                    [agent-prepared]
 • Patient reported passive SI on Nov 3 ¹         [source-verified]
 • ...

Likely plan objections
 1. Lower level of care not ruled out — add why outpatient failed
 2. No discharge plan with a date
 3. Nov 2 undocumented
```

## Evidence

```
Claims                         │ Progress note · Nov 3 · Dr. Ortiz (synthetic) v1
 ▸ Passive SI on Nov 3   ✓     │ ...
 ▸ Slept 5 hours Nov 3   ✓     │ "Patient reports [passive suicidal ideation without
 ▸ Family meeting held  ✗     │ plan or intent]..."
   unsupported                 │
[Flag citation] [Propose fix]  │ Type: direct quote · Extracted by Documentation v2
```

## Issues

```
⛔ Missing Nov 2 progress note        Critical · Owner: Coordinator · Due 3:00 PM
   Blocks approval. Resolve by: [Request document] [Attach document] [Escalate]

⛔ Requested vs authorized dates       Major · Owner: Clinician
   Authorized Nov 1–3 (auth record) · Requested Nov 4–6 (request)
   Resolve by: [Confirm intended period + reason] [Send to Authorization agent] [Escalate]
```

## Denial

```
Denied Nov 4–6 · Reason: "does not meet criteria for continued stay" ↗
Appeal deadline: Nov 20

Recommended next step: Peer-to-peer, then appeal if upheld
Overturn rate at external review (NY, inpatient detox): 61%

Similar cases
 NY 201908-120030 · Overturned · worsening withdrawal, unsafe home        [Open]
 NY 201908-119701 · Upheld · CIWA 2, COWS 0, uncomplicated course         [Open]

[Accept] [Peer-to-peer] [Resubmit] [Appeal]
```

## Approval

```
Packet v3 (read-only preview)                    hash 9f2c…e1
Validation   ✓ citations  ✓ dates  ✗ required documents  ✓ policy current
Blocked: Missing Nov 2 progress note (critical issue open)

☐ I reviewed the clinical statements in this exact version.
[Return for editing] [Request rework] [Escalate] [Approve — disabled]
```
