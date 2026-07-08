import type { ReactNode } from "react";

import WorkspaceRenderer from "@/components/workspace/WorkspaceRenderer";

export default function AppShell({ children }: { children: ReactNode }) {
  return <WorkspaceRenderer>{children}</WorkspaceRenderer>;
}
