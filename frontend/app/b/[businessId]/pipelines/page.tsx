import PipelinesExperience from "@/components/pipelines/PipelinesExperience";
import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";

export default async function PipelinesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const ctx = await getAuthorizedBusinessScope(businessId);
  const installation = await getCachedBusinessOsInstallation(businessId).catch(() => null);
  await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "pipelines", installation });
  return <PipelinesExperience businessId={businessId} />;
}
