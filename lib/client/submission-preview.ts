export type SubmissionScenario = "pending" | "approved" | "changed";
export type PreviewPacket = { version: number; hash: string };
export type SubmissionSnapshot = { packet: PreviewPacket; approval: (PreviewPacket & { clinician: string; signedAt: string }) | null };

// Fingerprints of synthetic preview descriptors, not live clinical packet hashes.
export const examplePacket4: PreviewPacket = { version: 4, hash: "8aaa1a4e726ec4984a29b7c559423f18aaa0dd0ce9ca5a8007d6b051929dbaba" };
const examplePacket5: PreviewPacket = { version: 5, hash: "80257088a0cff33f4adb3b054f9b9f2e63c8c1e32c2e7f77e4478958a4296a97" };
export function getSubmissionExample(scenario: SubmissionScenario): SubmissionSnapshot {
  return {
    packet: scenario === "changed" ? examplePacket5 : examplePacket4,
    approval: scenario === "pending" ? null : { ...examplePacket4, clinician: "Casey Rivera, LCSW (synthetic)", signedAt: "November 3, 2026 · 4:22 PM ET (example)" },
  };
}
export function samePreviewPacket(a: PreviewPacket | null, b: PreviewPacket): boolean { return a !== null && a.version === b.version && a.hash === b.hash; }
export function canPreparePreviewHandoff(snapshot: SubmissionSnapshot): boolean { return samePreviewPacket(snapshot.approval, snapshot.packet); }
export const demoReceiptPattern = /^DEMO-[A-Z0-9-]{3,60}$/i;
