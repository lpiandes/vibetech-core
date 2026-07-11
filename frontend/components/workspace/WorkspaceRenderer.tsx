"use client";

import type { ReactNode } from "react";

import PortalWorkspaceRenderer from "@/components/portal-renderer/WorkspaceRenderer";

/** @deprecated Prefer portal-renderer WorkspaceRenderer — kept as stable import path. */
export default function WorkspaceRenderer({ children }: { children: ReactNode }) {
  return <PortalWorkspaceRenderer>{children}</PortalWorkspaceRenderer>;
}
