import type { Metadata } from "next";
import "./globals.css";

import WorkspaceLayout from "@/components/layout/WorkspaceLayout";

export const metadata: Metadata = {
  title: "VIBETech Workspace",
  description: "VIBETech Workspace frontend foundation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <WorkspaceLayout>{children}</WorkspaceLayout>
      </body>
    </html>
  );
}
