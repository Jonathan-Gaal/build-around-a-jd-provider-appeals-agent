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
| Merge Umer's concurrent-review PRD with ours | Concurrent review (UR-1042) is the base workflow; denials reuse its evidence, issue and approval controls. See [PRD](../product/prd.md) |
| Merge Case Assembly into Drafting; Umer's Denial and Appeals agent = Case Match + Drafting | Keeps 7 LLM agents and the budget unchanged |
| Approval is bound to a packet version and hash, and any material change invalidates it | From Umer's PRD; makes approval auditable |
| Custom thin agent harness on `@anthropic-ai/sdk`, no agent framework | One JSON call per agent; we need control over validation, citations, audit and cost. See [agent harness](agent-harness.md) |
| Agents get no tools | They can't take actions, which limits prompt-injection damage |
| Quotes are verified in code against the source text | Cheapest strong guard against invented facts |
| Postgres + Drizzle, Auth.js, Zod, Vercel | See [tech stack](tech-stack.md) |
