import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
