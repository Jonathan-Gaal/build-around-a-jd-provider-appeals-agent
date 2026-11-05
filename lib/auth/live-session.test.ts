import { describe, expect, it } from "vitest";
import { isLiveAccount } from "./live-session";

describe("session liveness after sign-out", () => {
  const account = { role: "clinician", sessionVersion: 3 };
  it("accepts a token whose version matches the account", () => {
    expect(isLiveAccount(account, 3)).toBe(true);
  });
  it("rejects a copied token after sign-out bumped the version", () => {
    expect(isLiveAccount({ ...account, sessionVersion: 4 }, 3)).toBe(false);
  });
  it("rejects a token with no version, such as one issued before the column existed", () => {
    expect(isLiveAccount(account, undefined)).toBe(false);
  });
  it("rejects a deleted account and an unknown role", () => {
    expect(isLiveAccount(undefined, 3)).toBe(false);
    expect(isLiveAccount({ ...account, role: "owner" }, 3)).toBe(false);
  });
});
