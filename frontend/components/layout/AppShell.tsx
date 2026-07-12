import type { ReactNode } from "react";

import WorkspaceRenderer from "@/components/workspace/WorkspaceRenderer";

/**
 * App shell for business-scoped routes — delegates to WorkspaceRenderer → BusinessShell.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return <WorkspaceRenderer>{children}</WorkspaceRenderer>;
}
