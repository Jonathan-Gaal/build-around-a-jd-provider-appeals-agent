import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser } from "./config";
import { roleHome, type Role } from "./roles";
export async function requirePageRole(roles: readonly Role[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!roles.some(role => role === user.role)) redirect(roleHome(user.role));
  return user;
}
