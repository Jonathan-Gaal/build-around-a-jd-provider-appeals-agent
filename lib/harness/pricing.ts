/**
 * USD per million tokens. Update when pricing changes; budget.md depends on it.
 * Cache writes cost 1.25x input; cache reads cost 0.1x input.
 */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model];
  if (!p) throw new Error(`No price for model "${model}". Add it to lib/harness/pricing.ts.`);
  const perTok = (usd: number) => usd / 1_000_000;
  return (
    u.input_tokens * perTok(p.input) +
    (u.cache_creation_input_tokens ?? 0) * perTok(p.input) * 1.25 +
    (u.cache_read_input_tokens ?? 0) * perTok(p.input) * 0.1 +
    u.output_tokens * perTok(p.output)
  );
}
