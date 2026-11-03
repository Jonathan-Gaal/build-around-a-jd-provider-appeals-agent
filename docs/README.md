# Docs

Design and research docs for the provider-side behavioral-health denial appeals agent. Patient data in this project is synthetic only.

Live working doc (Claude Doc): https://claude.ai/artifact/TbFk34xC1nF9bZJ2MEzG84

| Folder | What's in it |
| --- | --- |
| [research/](research/) | The job description we built around, how each duty maps to features (JD coverage), and the sources we dropped |
| [product/](product/) | The PRD, user stories, user flow and wireframes |
| [architecture/](architecture/) | Tech stack, agent harness, agent specs, database schema, API, agents, agentic loop, budget, security and the decision log |
| [plan/](plan/) | Build plan: milestones, tasks and owners |
| [data/](data/) | What the NY and CA appeal data can and can't do, and the synthetic patient packets |
| [diagrams/](diagrams/) | PNG exports of the user flow, denial run and agentic loop |

The cleaned datasets and the script that builds them live in [`../data/`](../data/) and [`../scripts/`](../scripts/).

## Start here

1. [PRD](product/prd.md): what we're building and why
2. [Job description](research/job-descriptions.md)
3. [User stories](product/user-stories.md) and [user flow](product/user-flow.md)
4. [Tech stack](architecture/tech-stack.md), [agent harness](architecture/agent-harness.md) and the [reference agent](architecture/reference-agent.md)
5. [Agents](architecture/agents.md) and [agentic loop](architecture/agentic-loop.md)
6. [Data assessment](data/data-assessment.md)
7. [Decision log](architecture/decisions.md)
8. [Build plan](plan/build-plan.md), then [database schema](architecture/database-schema.md), [agent specs](architecture/agent-specs.md), [API](architecture/api.md) and [wireframes](product/wireframes.md)

Synthetic test cases live in [`../fixtures/`](../fixtures/). Rules for AI coding assistants are in [`../CLAUDE.md`](../CLAUDE.md).
