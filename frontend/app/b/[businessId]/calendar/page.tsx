import CalendarExperience from "@/components/calendar/CalendarExperience";
import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const ctx = await getAuthorizedBusinessScope(businessId);
  const installation = await getCachedBusinessOsInstallation(businessId).catch(() => null);
  await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "calendar", installation });
  const currentUserId = String((ctx as any)?.authz?.user?.id ?? (ctx as any)?.user?.id ?? "") || null;
  return (
    <CalendarExperience
      businessId={businessId}
      integrationsHref={`/b/${encodeURIComponent(businessId)}/integrations`}
      currentUserId={currentUserId}
    />
  );
}
