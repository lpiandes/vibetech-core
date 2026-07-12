"use client";

import type { ReactNode } from "react";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { resolveModulePresentation } from "@/lib/portal-renderer/registries.js";
import EmptyStateRenderer from "./EmptyStateRenderer";

/**
 * Module Renderer — resolves installed Business OS modules to registered presentations.
 * Does not generate React dynamically; pages still supply concrete children for known routes.
 */
export default function ModuleRenderer({
  moduleId,
  children,
  emptyFallback = true,
}: {
  moduleId?: string | null;
  children: ReactNode;
  emptyFallback?: boolean;
}) {
  const scope = useBusinessScope();
  const installed = scope.installedBusinessOS;
  const modules = installed?.modules ?? scope.installedNavigation?.modules ?? [];
  const module = moduleId
    ? modules.find((entry: any) => String(entry.moduleId) === String(moduleId))
    : null;

  const presentation = moduleId
    ? resolveModulePresentation(moduleId, (module?.viewType as any) ?? null)
    : { allowed: true, viewType: null, moduleId: "" };

  if (moduleId && !presentation.allowed && emptyFallback) {
    const empty = installed?.emptyStates?.[moduleId];
    return (
      <EmptyStateRenderer
        title={String(module?.label ?? moduleId)}
        description={empty?.description ?? "This area is not set up for this business yet. Ask VIBETech what to enable next."}
      />
    );
  }

  return <>{children}</>;
}

export function useInstalledModule(moduleId: string) {
  const scope = useBusinessScope();
  const modules = scope.installedBusinessOS?.modules ?? scope.installedNavigation?.modules ?? [];
  return modules.find((entry: any) => String(entry.moduleId) === String(moduleId)) ?? null;
}
