import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import * as s from "../db/schema";
import type { RouteContext } from "../http/with-route";
import { HttpError } from "../http/errors";
import { loadValidation } from "../validation/snapshot";
import { recheckApproval } from "./approval";
import { writeAudit } from "../audit/write";
export const assignmentSchema = z.object({ assignedTo: z.uuid(), expectedAssignedTo: z.uuid() }).strict();
export async function assignCase({ db, caseId, user, body }: RouteContext) {
  const input = assignmentSchema.parse(body);
  const [row] = await db.select().from(s.cases).where(eq(s.cases.id, caseId!));
  if (row.assignedTo !== input.expectedAssignedTo) throw new HttpError(409, "assignment_changed");
  const [active] = await db.select({ id: s.runGroups.id }).from(s.runGroups).where(and(eq(s.runGroups.caseId, caseId!), eq(s.runGroups.status, "running")));
  if (active) throw new HttpError(409, "active_run");
  const [target] = await db.select({ id: s.users.id }).from(s.users).innerJoin(s.caseMembers, eq(s.caseMembers.userId, s.users.id)).where(and(eq(s.caseMembers.caseId, caseId!), eq(s.users.id, input.assignedTo), eq(s.users.role, "clinician")));
  if (!target) throw new HttpError(422, "eligible_clinician_required");
  if (row.assignedTo === target.id) return { assignedTo: target.id, changed: false };
  await db.update(s.cases).set({ assignedTo: target.id, updatedAt: new Date() }).where(eq(s.cases.id, caseId!));
  await db.update(s.issues).set({ ownerId: target.id }).where(and(eq(s.issues.caseId, caseId!), ne(s.issues.status, "resolved")));
  await recheckApproval(db, caseId!, user.userId, "assignment_changed");
  await writeAudit(db, { actor: user.userId, caseId: caseId!, action: "case_assigned", objectType: "user", objectId: target.id, reasonCode: "manager_assignment" });
  return { assignedTo: target.id, changed: true };
}
export async function readApprovedPacket({ db, caseId, user }: RouteContext, audit = true) {
  const [row] = await db.select().from(s.cases).where(eq(s.cases.id, caseId!));
  const validation = await loadValidation(db, caseId!);
  const packet = validation.packet;
  if (row.status !== "approved_for_submission" || !packet || validation.blockers.length || validation.hash !== packet.contentHash) throw new HttpError(409, "current_approval_required");
  const [latestRun] = await db.select().from(s.runGroups).where(eq(s.runGroups.caseId, caseId!)).orderBy(desc(s.runGroups.startedAt)).limit(1);
  const documents = await db.select({ receivedAt: s.documents.receivedAt }).from(s.documents).where(eq(s.documents.caseId, caseId!));
  if (!latestRun || latestRun.status !== "complete" || documents.some(document => document.receivedAt > latestRun.startedAt)) throw new HttpError(409, "current_approval_required");
  const [approval] = await db.select().from(s.approvals).where(and(eq(s.approvals.caseId, caseId!), eq(s.approvals.packetVersionId, packet.id), eq(s.approvals.contentHash, packet.contentHash), eq(s.approvals.status, "valid"))).orderBy(desc(s.approvals.createdAt)).limit(1);
  if (!approval) throw new HttpError(409, "current_approval_required");
  const claims = await db.select({ id: s.claims.id, text: s.claims.text, sectionHeading: s.claims.sectionHeading }).from(s.claims).where(and(eq(s.claims.packetVersionId, packet.id), ne(s.claims.status, "rejected")));
  if (audit) await writeAudit(db, { actor: user.userId, caseId: caseId!, action: "approved_packet_viewed", objectType: "packet_version", objectId: packet.id });
  return { caseId, packetVersionId: packet.id, version: packet.version, contentHash: packet.contentHash, approval: { id: approval.id, approvedBy: approval.approvedBy, createdAt: approval.createdAt }, claims: claims.filter(claim => packet.includedClaimIds.includes(claim.id)) };
}
