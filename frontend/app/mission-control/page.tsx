import { WorkspaceService } from "@/lib/workspace/WorkspaceService";

import MissionControlRenderer from "@/components/mission-control/MissionControlRenderer";

export default function MissionControlPage() {
  const service = new WorkspaceService();
  const viewModel = service.loadMissionControlViewModel();

  return <MissionControlRenderer viewModel={viewModel} />;
}

