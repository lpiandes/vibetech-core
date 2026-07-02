import type { ReactNode } from "react";

import { WorkspaceService } from "@/lib/workspace/WorkspaceService";

import WorkspaceRenderer from "@/components/workspace/WorkspaceRenderer";

export default function AppShell({ children }: { children: ReactNode }) {
  const service = new WorkspaceService();
  const workspaceViewModel = service.loadWorkspaceViewModel();

  return (
    <WorkspaceRenderer workspaceViewModel={workspaceViewModel}>
      {children}
    </WorkspaceRenderer>
  );
}

