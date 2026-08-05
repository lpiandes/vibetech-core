import type { Metadata } from "next";
import "./globals.css";

import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "VIBETech",
  description: "VIBETech business operating system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased dark", "font-sans")}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
