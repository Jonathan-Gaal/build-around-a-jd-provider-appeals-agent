import { notFound } from "next/navigation";
import { CaseWorkspace, type CaseTab } from "@/components/case-workspace";

const tabs: CaseTab[] = ["summary", "evidence", "issues", "recheck", "approval"];

export default async function CasePage({ params }: { params: Promise<{ id: string; tab: string }> }) {
  const { id, tab } = await params;
  if (!tabs.includes(tab as CaseTab)) notFound();
  return <CaseWorkspace caseId={id} tab={tab as CaseTab} />;
}
