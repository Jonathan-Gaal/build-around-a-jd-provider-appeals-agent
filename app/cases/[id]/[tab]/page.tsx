import { notFound } from "next/navigation";
import { CaseWorkspace, type CaseTab } from "@/components/case-workspace";
import { requirePageRole } from "@/lib/auth/page-access";
import { caseAccessRecord } from "@/lib/auth/case-scope";
import { checkCaseAccess } from "@/lib/auth/access";
import { getDb } from "@/lib/db";

const tabs: CaseTab[] = ["summary", "evidence", "issues", "recheck", "approval", "attachment", "dates"];

export default async function CasePage({ params }: { params: Promise<{ id: string; tab: string }> }) {
  const user = await requirePageRole(["clinician"]);
  const { id, tab } = await params;
  if (!checkCaseAccess(user, "read_case", await caseAccessRecord(getDb(), id, user)).allowed) notFound();
  if (!tabs.includes(tab as CaseTab)) notFound();
  return <CaseWorkspace caseId={id} tab={tab as CaseTab} />;
}
