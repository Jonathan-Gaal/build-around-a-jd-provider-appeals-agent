import { notFound } from "next/navigation";
import { WorkspaceOverview, type WorkspaceView } from "@/components/workspace-overview";
import { requirePageRole } from "@/lib/auth/page-access";
const views: WorkspaceView[] = ["my-reviews", "requests", "activity", "profile", "notifications", "search"];
export default async function Page({ params }: { params: Promise<{ workspace: string }> }) {
  await requirePageRole(["clinician"]);
  const { workspace } = await params;
  if (!views.includes(workspace as WorkspaceView)) notFound();
  return <WorkspaceOverview view={workspace as WorkspaceView} />;
}
