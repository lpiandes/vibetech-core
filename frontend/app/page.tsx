import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { platformStore } from "../../backend/core/platform/persistence/PostgresPlatformStore.js";
import { PLATFORM_ROLES } from "../../backend/core/platform/permissions/rolePermissions.js";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN) {
    redirect("/platform");
  }

  const businesses = await platformStore.listBusinessesForUser(session.user.id);
  if (businesses.length === 1) {
    redirect(`/b/${businesses[0].id}/home`);
  }
  if (businesses.length > 1) {
    redirect("/platform");
  }

  redirect("/login?error=no_business");
}
