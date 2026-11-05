import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-access";
import { ROLES, roleHome } from "@/lib/auth/roles";
export default async function Page() { const user = await requirePageRole(ROLES); redirect(roleHome(user.role)); }