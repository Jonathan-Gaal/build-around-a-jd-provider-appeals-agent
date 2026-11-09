import { z } from "zod";
import type { SignOffSnapshot } from "./review-state";
import { isCurrentPacketValid } from "./review-state";

// The existing POST /approve returns this record. No browser state grants approval.
export const approvalRecordSchema = z.object({
  id: z.uuid(), caseId: z.string(), packetVersionId: z.uuid(), contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  approvedBy: z.uuid(), role: z.literal("clinician"), acknowledgement: z.string(),
  status: z.enum(["valid", "invalidated"]), createdAt: z.iso.datetime({ offset: true }),
});
export const approvalReceiptSchema = z.object({ record: approvalRecordSchema, version: z.number().int().positive() });
export type ApprovalReceipt = z.infer<typeof approvalReceiptSchema>;
export function receiptStorageKey(userId: string, caseId: string): string { return `wellline-approval-receipt:${userId}:${caseId}`; }
export function readApprovalReceipt(raw: string | null, userId: string, caseId: string): ApprovalReceipt | null {
  try {
    const result = approvalReceiptSchema.safeParse(JSON.parse(raw ?? "null"));
    return result.success && result.data.record.approvedBy === userId && result.data.record.caseId === caseId ? result.data : null;
  } catch { return null; }
}
export function isReceiptCurrent(receipt: ApprovalReceipt, data: SignOffSnapshot): boolean {
  return data.detail.case.status === "approved_for_submission" && isCurrentPacketValid(data)
    && receipt.record.status === "valid"
    && receipt.record.packetVersionId === data.validation.packetVersionId
    && receipt.record.contentHash === data.validation.contentHash;
}
