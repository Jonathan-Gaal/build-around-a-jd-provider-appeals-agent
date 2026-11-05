import { afterEach, describe, expect, it, vi } from "vitest";
import { readCaseSnapshot } from "./case-snapshot";

function installApi(changing = false, incoherentClaims = false) {
  let caseReads = 0;
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    urls.push(url);
    if (url === "/api/cases/UR-1042") {
      caseReads++;
      const id = changing && caseReads > 1 ? "packet-2" : "packet-1";
      return Response.json({ case: { status: "needs_review", updatedAt: "now" }, latestPacketVersion: { id, contentHash: id }, latestRunGroupId: "run-1", reviewPeriod: { version: 1 } });
    }
    if (url === "/api/auth/session") return Response.json({ user: { id: "clinician", name: "Demo", role: "clinician" } });
    if (url.includes("/claims")) return Response.json([{ id: "claim-1", packetVersionId: incoherentClaims ? "wrong-packet" : new URL(url, "http://localhost").searchParams.get("packetVersion") }]);
    if (url.endsWith("/validation")) { const id = changing && caseReads > 1 ? "packet-2" : "packet-1"; return Response.json({ packetVersionId: id, contentHash: id, blockers: [] }); }
    if (url.startsWith("/api/runs/")) return Response.json({ id: "run-1", status: "complete" });
    return Response.json([]);
  }));
  return urls;
}
afterEach(() => vi.unstubAllGlobals());
describe("coherent clinician packet load", () => {
  it("requests claims for the exact displayed packet version", async () => { const urls = installApi(); const data = await readCaseSnapshot("UR-1042"); expect(urls).toContain("/api/cases/UR-1042/claims?packetVersion=packet-1"); expect(data.claims[0].packetVersionId).toBe(data.detail.latestPacketVersion?.id); });
  it("retries if a new packet arrives while loading", async () => { installApi(true); const data = await readCaseSnapshot("UR-1042"); expect(data.detail.latestPacketVersion?.id).toBe("packet-2"); expect(data.claims[0].packetVersionId).toBe("packet-2"); });
  it("fails closed instead of displaying mixed packet claims", async () => { installApi(false, true); await expect(readCaseSnapshot("UR-1042")).rejects.toThrow("packet_changed_during_load"); });
});
