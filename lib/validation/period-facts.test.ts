import { describe, expect, it } from "vitest";
import { CODE_CLAIM_AUTHOR, PERIOD_FACT_IDS, isPeriodFactId, needsQuoteEvidence } from "./period-facts";

const claim = { author: "case_assembly_drafting", type: "clinical_fact", status: "source_verified", material: true };

describe("period facts", () => {
  it("recognizes only the two reserved IDs", () => {
    expect(isPeriodFactId(PERIOD_FACT_IDS.requested)).toBe(true);
    expect(isPeriodFactId(PERIOD_FACT_IDS.authorized)).toBe(true);
    expect(isPeriodFactId("f1")).toBe(false);
    expect(isPeriodFactId("")).toBe(false);
  });
});

describe("needsQuoteEvidence", () => {
  it("requires evidence for a verified model claim of any type", () => {
    expect(needsQuoteEvidence(claim)).toBe(true);
    expect(needsQuoteEvidence({ ...claim, type: "narrative" })).toBe(true);
  });
  it("exempts only an administrative fact written by code", () => {
    expect(needsQuoteEvidence({ ...claim, author: CODE_CLAIM_AUTHOR, type: "administrative_fact" })).toBe(false);
    expect(needsQuoteEvidence({ ...claim, type: "administrative_fact" })).toBe(true);
    expect(needsQuoteEvidence({ ...claim, author: CODE_CLAIM_AUTHOR })).toBe(true);
  });
  it("leaves unverified and non-material claims to the gate", () => {
    expect(needsQuoteEvidence({ ...claim, status: "unsupported" })).toBe(false);
    expect(needsQuoteEvidence({ ...claim, material: false })).toBe(false);
  });
});
