import { forbidden, unauthorized } from "next/navigation";

import { authorizePlatformAdmin, AuthorizationError } from "@/lib/server/compose";
import { getSessionUser, requireSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";

/**
 * Platform-admin gate for Server Components — uses Next.js unauthorized()/forbidden().
 */
export async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user) unauthorized();

  try {
    await authorizePlatformAdmin({
      userId: user.id,
      platformRole: user.platformRole ?? null,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) forbidden();
    throw err;
  }

  return user;
}

/** API-safe variant — throws AuthorizationError for JSON 401/403 handling. */
export async function requirePlatformAdminApi() {
  const user = await requireSessionUser();
  await authorizePlatformAdmin({
    userId: user.id,
    platformRole: user.platformRole ?? null,
  });
  return user;
}
