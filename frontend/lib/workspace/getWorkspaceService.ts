import { cookies } from "next/headers";

import { WorkspaceService } from "./WorkspaceService";

export const SELECTED_WORKSPACE_COOKIE = "vibetech_workspace_id";

export function getSelectedWorkspaceId(): string | null {
  const cookieStore = cookies() as unknown as { get: (name: string) => { value: string } | undefined };
  return cookieStore.get(SELECTED_WORKSPACE_COOKIE)?.value ?? null;
}

export function getWorkspaceService(): WorkspaceService {
  const workspaceId = getSelectedWorkspaceId();
  if (!workspaceId) {
    throw new Error("No workspace selected. Choose a business from the home screen.");
  }
  return new WorkspaceService({ workspaceId });
}
