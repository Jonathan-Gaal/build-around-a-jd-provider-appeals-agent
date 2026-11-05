import { requirePageRole } from "@/lib/auth/page-access";
import { RoleWorkspace } from "@/components/role-workspace";
export default async function Page() { await requirePageRole(["packet_staff"]); return <RoleWorkspace role="packet_staff" />; }
