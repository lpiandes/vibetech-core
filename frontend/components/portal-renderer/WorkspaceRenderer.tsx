"use client";

import type { ReactNode } from "react";
import ProductShell from "@/components/shell/ProductShell";

/**
 * Workspace Renderer — Business OS portal shell host.
 * Scope (nav/dashboards/terminology) is provided by BusinessScopeProvider.
 */
export default function WorkspaceRenderer({ children }: { children: ReactNode }) {
  return <ProductShell>{children}</ProductShell>;
}
