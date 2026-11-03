# Decision log

Decisions made during design, Nov 2026.

| Decision | Why |
| --- | --- |
| Build around the Ritten Authorization (UR) Specialist JD | It names denials, appeals, peer-to-peer, denial-trend tracking, ASAM and the levels of care we cover. The TaraVista posting closed |
| Provider side, synthetic patients only | No PHI, no BAA needed |
| Stack: Next.js + TypeScript + SQL + React | One language end to end. See [security](security.md) |
| <a id="plain-code-orchestrator"></a>Plain-code orchestrator, not an LLM | The order of steps is known in advance, so code makes it predictable, testable and free. LLM calls are saved for reading and writing |
| Code prefilters 10 cases before Case Match | The LLM never reads the whole dataset, which saves tokens and keeps matches explainable |
| Add Case Match, Appeal Drafting and Insurer Reviewer to Umer's four agents | Denials need matching and drafting. The reviewer adds denial prevention |
| Insurer Reviewer runs once per run, before submission and on appeal drafts | Once is enough. After every step would multiply cost and repeat itself |
| Insurer Reviewer uses generic questions and upheld NY cases, not one insurer's rules | Centene is one company in Texas, so it's context only |
| Exclude Umpqua CE05 | One Oregon plan, from 2022, with no matching case data |
| Keep both NY and CA datasets, never pool their rates | They cover different care types. See [data assessment](../data/data-assessment.md) |
| Hold out the 5 source cases behind the synthetic packets | Otherwise the agent finds its own answer key |
| Test on Haiku 5.5, demo on Sonnet or Opus 5.5 | Keeps the $40 budget. See [budget](budget.md) |
