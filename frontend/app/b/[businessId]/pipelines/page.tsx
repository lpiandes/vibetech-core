import PipelinesExperience from "@/components/pipelines/PipelinesExperience";
import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";

export default async function PipelinesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const ctx = await getAuthorizedBusinessScope(businessId);
  await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "pipelines" });
  return <PipelinesExperience businessId={businessId} />;
}
