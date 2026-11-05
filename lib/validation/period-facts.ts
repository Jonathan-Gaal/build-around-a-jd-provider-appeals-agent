// Code computes the two review periods from source documents, so they carry fixed fact IDs.
// Code treats them as verified, and a claim that cites only them needs no quote evidence.
export const PERIOD_FACT_IDS = { requested: "period-requested", authorized: "period-authorized" } as const;

const PERIOD_IDS: readonly string[] = Object.values(PERIOD_FACT_IDS);

export function citesOnlyPeriodFacts(factIds: readonly string[]): boolean {
  return factIds.length > 0 && factIds.every((id) => PERIOD_IDS.includes(id));
}
