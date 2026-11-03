# Budget

We get a $40 Anthropic API key. It pays only for the agents running inside the app. We write the code with our own LLM subscriptions.

One full denial run makes 8 or 9 Claude calls across the 7 LLM agents, using about 70,000 input tokens and 30,000 output tokens, including thinking. That's a rough estimate from typical document sizes. Measure it on the first real run.

| Model | Price per million tokens, input / output | Cost per denial run | Denial runs from $40 |
| --- | --- | --- | --- |
| Claude Haiku 5.5 | $0.10 / $0.50 | about $0.03 | about 1,300 |
| Claude Sonnet 5.5 | $2 / $10 | about $0.45 | about 90 |
| Claude Opus 5.5 | $4 / $20 | about $0.90 | about 45 |

Prices are from Anthropic's price list as of November 2026.

Testing is where most of the $40 goes, because the agents run every time we test the app. Three habits keep us well under it:

1. **Build and test on Haiku 5.5.** Switch to Sonnet 5.5 or Opus 5.5 for final testing and the live demo. Keep the model name in one config value so it's a one-line change.
2. **Use prompt caching.** The criteria summary and each agent's instructions are identical on every run, so caching cuts their repeat cost by about 90%.
3. **Save each agent's output to a file during development.** Then rerun only the agent you're changing, not the whole pipeline.
