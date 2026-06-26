import type { ReactNode } from "react";

import AppShell from "./AppShell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

