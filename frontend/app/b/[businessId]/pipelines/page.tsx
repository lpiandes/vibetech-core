import PipelinesExperience from "@/components/pipelines/PipelinesExperience";
import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";

export default async function PipelinesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const ctx = await getAuthorizedWorkspace(businessId);
  await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "pipelines" });
  return <PipelinesExperience businessId={businessId} />;
}
