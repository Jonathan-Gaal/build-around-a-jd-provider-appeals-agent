# Docs

Design and research docs for the provider-side behavioral-health denial appeals agent. Patient data in this project is synthetic only.

Live working doc (Claude Doc): https://claude.ai/artifact/TbFk34xC1nF9bZJ2MEzG84

| Folder | What's in it |
| --- | --- |
| [research/](research/) | The job description we built around, and the sources we considered and dropped |
| [product/](product/) | The PRD and the user flow |
| [architecture/](architecture/) | Tech stack, agent harness, agents, agentic loop, budget, security and the decision log |
| [data/](data/) | What the NY and CA appeal data can and can't do, and the synthetic patient packets |
| [diagrams/](diagrams/) | PNG exports of the user flow, denial run and agentic loop |

The cleaned datasets and the script that builds them live in [`../data/`](../data/) and [`../scripts/`](../scripts/).

## Start here

1. [PRD](product/prd.md): what we're building and why
2. [Job description](research/job-descriptions.md)
3. [User flow](product/user-flow.md)
4. [Tech stack](architecture/tech-stack.md) and [agent harness](architecture/agent-harness.md)
5. [Agents](architecture/agents.md) and [agentic loop](architecture/agentic-loop.md)
6. [Data assessment](data/data-assessment.md)
7. [Decision log](architecture/decisions.md)
