// Code states the two review periods itself, from stored values, as administrative facts.
// Model claims can't borrow that standing: citing a period ID verifies nothing.
export const PERIOD_FACT_IDS = { requested: "period-requested", authorized: "period-authorized" } as const;
export const CODE_CLAIM_AUTHOR = "code";

const PERIOD_IDS: readonly string[] = Object.values(PERIOD_FACT_IDS);

export function isPeriodFactId(id: string): boolean {
  return PERIOD_IDS.includes(id);
}

export function needsQuoteEvidence(claim: { author: string; type: string; status: string; material: boolean }): boolean {
  if (!claim.material || claim.status !== "source_verified") return false;
  return !(claim.author === CODE_CLAIM_AUTHOR && claim.type === "administrative_fact");
}
