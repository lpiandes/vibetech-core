import { authorizePlatformAdmin } from "@/lib/server/compose";
import { requireSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";

export async function requirePlatformAdmin() {
  const user = await requireSessionUser();
  await authorizePlatformAdmin({ userId: user.id, platformRole: user.platformRole ?? null });
  return user;
}
