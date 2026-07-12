import type { ReactNode } from "react";
import { forbidden, unauthorized } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import { getSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";

/**
 * Admin boundary — PLATFORM_ADMIN only.
 * Uses Next.js forbidden()/unauthorized() so failures never render AdminShell.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) unauthorized();
  if (user.platformRole !== "PLATFORM_ADMIN") forbidden();

  return <AdminShell>{children}</AdminShell>;
}
