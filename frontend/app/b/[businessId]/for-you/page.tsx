import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import MissionControlRenderer from "@/components/mission-control/MissionControlRenderer";

export default async function ForYouPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { service } = await getAuthorizedWorkspace(businessId);
  const viewModel = service.loadMissionControlViewModel();
  return <MissionControlRenderer viewModel={viewModel} />;
}
