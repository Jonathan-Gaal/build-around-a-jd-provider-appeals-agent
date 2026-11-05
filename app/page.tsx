import { WorkspaceOverview } from "@/components/workspace-overview";
import { requirePageRole } from "@/lib/auth/page-access";
export default async function Page() { await requirePageRole(["clinician"]); return <WorkspaceOverview view="queue" />; }
