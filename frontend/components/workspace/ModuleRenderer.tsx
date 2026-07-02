import type { ReactNode } from "react";

export default function ModuleRenderer({
  children,
}: {
  workspaceViewModel: any;
  children: ReactNode;
}) {
  // Sprint 3 foundation: route-to-module mapping remains unchanged.
  // ModuleRenderer exists to centralize future module container selection.
  return <>{children}</>;
}

