"use client";

import type { ReactNode } from "react";
import PortalModuleRenderer from "@/components/portal-renderer/ModuleRenderer";

/** Stable ModuleRenderer entry — delegates to universal portal module renderer. */
export default function ModuleRenderer({
  moduleId,
  children,
}: {
  moduleId?: string | null;
  children: ReactNode;
}) {
  return <PortalModuleRenderer moduleId={moduleId}>{children}</PortalModuleRenderer>;
}
