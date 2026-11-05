import "server-only";
import { and, eq, exists } from "drizzle-orm";
import type { Db } from "../db";
import { cases, caseMembers } from "../db/schema";
import type { SessionUser } from "./access";
/** Role membership is per case. No role receives global access to cases. */
export function caseScope(db: Db, user: SessionUser) {
  return user.role === "clinician" ? eq(cases.assignedTo, user.userId)
    : exists(db.select({ userId: caseMembers.userId }).from(caseMembers).where(and(eq(caseMembers.caseId, cases.id), eq(caseMembers.userId, user.userId))));
}
export async function caseAccessRecord(db: Db, caseId: string, user: SessionUser) {
  const [row] = await db.select({ assignedTo: cases.assignedTo }).from(cases).where(eq(cases.id, caseId));
  if (!row) return null;
  const [member] = user.role === "clinician" ? [] : await db.select({ userId: caseMembers.userId }).from(caseMembers).where(and(eq(caseMembers.caseId, caseId), eq(caseMembers.userId, user.userId)));
  return { ...row, member: Boolean(member) };
}
