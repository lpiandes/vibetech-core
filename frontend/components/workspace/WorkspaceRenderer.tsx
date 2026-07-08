"use client";

import type { ReactNode } from "react";

import ProductShell from "@/components/shell/ProductShell";

export default function WorkspaceRenderer({ children }: { children: ReactNode }) {
  return <ProductShell>{children}</ProductShell>;
}
