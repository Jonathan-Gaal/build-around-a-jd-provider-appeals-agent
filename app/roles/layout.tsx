import type { ReactNode } from "react";
import { requirePageRole } from "@/lib/auth/page-access";
import { ROLES } from "@/lib/auth/roles";
export default async function Layout({ children }: { children: ReactNode }) { await requirePageRole(ROLES); return children; }