import { describe, expect, it } from "vitest";
import { PERIOD_FACT_IDS, citesOnlyPeriodFacts } from "./period-facts";

describe("period facts", () => {
  it("exempts a claim that cites only code-computed periods from quote evidence", () => {
    expect(citesOnlyPeriodFacts([PERIOD_FACT_IDS.requested])).toBe(true);
    expect(citesOnlyPeriodFacts([PERIOD_FACT_IDS.requested, PERIOD_FACT_IDS.authorized])).toBe(true);
  });
  it("still requires quotes for clinical facts, mixed citations, or none", () => {
    expect(citesOnlyPeriodFacts(["f1"])).toBe(false);
    expect(citesOnlyPeriodFacts([PERIOD_FACT_IDS.requested, "f1"])).toBe(false);
    expect(citesOnlyPeriodFacts([])).toBe(false);
  });
});
