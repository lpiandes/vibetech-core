import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import MissionControlRenderer from "@/components/mission-control/MissionControlRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

/** Explicit Mission Control route for installed Business OS. */
export default async function BusinessMissionControlPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return runTimedPage("mission-control", async () => {
    const { service } = await getAuthorizedWorkspace(businessId);
    const viewModel = service.loadMissionControlViewModel();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });
    return <MissionControlRenderer viewModel={viewModel as never} variant="mission_control" />;
  });
}
