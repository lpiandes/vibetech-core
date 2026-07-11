import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { platformStore } from "@/lib/server/compose";
import { PLATFORM_ROLES } from "../../../../../backend/core/platform/permissions/rolePermissions.js";

/**
 * Member-facing business list — never crosses tenants.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const memberships = await platformStore.listBusinessesForUser(session.user.id);
  const businesses = [];
  for (const row of memberships) {
    const membership = await platformStore.getMembership(session.user.id, row.id);
    businesses.push({
      id: String(row.id),
      name: String(row.name ?? "Business"),
      role: membership?.role ? String(membership.role) : null,
      kind: row.kind ?? "NORMAL",
    });
  }

  let adminDirectory: Array<{ id: string; name: string }> = [];
  if (session.user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN) {
    const all = await platformStore.listBusinesses();
    adminDirectory = all.slice(0, 50).map((row: any) => ({
      id: String(row.id),
      name: String(row.name ?? "Business"),
    }));
  }

  return NextResponse.json({
    ok: true,
    businesses,
    adminDirectory,
    isPlatformAdmin: session.user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN,
  });
}
