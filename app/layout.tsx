import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceProvider } from "@/components/workspace-shell";

export const metadata: Metadata = {
  title: "Wellline Review · Clinician Workspace",
  description: "Behavioral-health utilization review workspace (synthetic data only)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><WorkspaceProvider>{children}</WorkspaceProvider></body>
    </html>
  );
}
