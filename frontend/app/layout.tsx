import type { Metadata } from "next";
import "./globals.css";

import WorkspaceLayout from "@/components/layout/WorkspaceLayout";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col">
        <WorkspaceLayout>{children}</WorkspaceLayout>
      </body>
    </html>
  );
}
