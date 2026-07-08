import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import WorkspaceLayout from "@/components/layout/WorkspaceLayout";
import { SELECTED_WORKSPACE_COOKIE } from "@/lib/workspace/getWorkspaceService";

export default async function ProductWorkspaceLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(SELECTED_WORKSPACE_COOKIE)?.value;
  if (!workspaceId) {
    redirect("/");
  }

  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
