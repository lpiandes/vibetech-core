"use client";

import type { ReactNode } from "react";
import BusinessShell from "./BusinessShell";

/** @deprecated Prefer BusinessShell — kept as alias for WorkspaceRenderer. */
export default function ProductShell({ children }: { children: ReactNode }) {
  return <BusinessShell>{children}</BusinessShell>;
}
