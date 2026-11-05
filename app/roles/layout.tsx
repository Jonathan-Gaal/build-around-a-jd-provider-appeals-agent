import type { ReactNode } from "react";
import { RolePreviewProvider } from "@/components/role-preview-context";
export default function Layout({ children }: { children: ReactNode }) { return <RolePreviewProvider>{children}</RolePreviewProvider>; }
