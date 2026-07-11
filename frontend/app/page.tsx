import { cookies } from "next/headers";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { platformStore } from "@/lib/server/compose";
import { LAST_BUSINESS_COOKIE } from "@/lib/platform/businessCookies";
import { PLATFORM_ROLES } from "../../backend/core/platform/permissions/rolePermissions.js";

/**
 * Intelligent product entry — one VIBETech, role-aware.
 */
export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isAdmin = session.user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN;
  const businesses = await platformStore.listBusinessesForUser(session.user.id);
  const cookieStore = await cookies();
  const lastBusinessId = cookieStore.get(LAST_BUSINESS_COOKIE)?.value ?? null;

  // Prefer resuming last business when the user still has membership.
  if (lastBusinessId && businesses.some((row: any) => String(row.id) === String(lastBusinessId))) {
    redirect(`/b/${lastBusinessId}/home`);
  }

  if (businesses.length === 1) {
    redirect(`/b/${businesses[0].id}/home`);
  }

  if (businesses.length > 1) {
    redirect("/businesses");
  }

  if (isAdmin) {
    redirect("/admin");
  }

  // No membership — offer Architect design entry.
  redirect("/architect");
}
