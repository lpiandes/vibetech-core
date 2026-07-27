import PipelinesExperience from "@/components/pipelines/PipelinesExperience";
import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";

export default async function PipelinesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await getAuthorizedWorkspace(businessId);
  return <PipelinesExperience businessId={businessId} />;
}
