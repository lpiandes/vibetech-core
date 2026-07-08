import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import MissionControlRenderer from "@/components/mission-control/MissionControlRenderer";
import type { MissionControlViewModel } from "@/components/mission-control/MissionControlContext";

export default async function MissionControlPage() {
  // Make the route "asynchronous" so Next can display `loading.tsx` during render.
  // Keep it deterministic and non-blocking.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const service = getWorkspaceService();
  const viewModel = service.loadMissionControlViewModel() as MissionControlViewModel;
  return <MissionControlRenderer viewModel={viewModel} />;
}

