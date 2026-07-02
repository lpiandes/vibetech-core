import { WorkspaceService } from "@/lib/workspace/WorkspaceService";
import TeamRenderer from "@/components/team/TeamRenderer";
import type { TeamViewModel } from "@/components/team/TeamContext";

export default function TeamPage() {
  const service = new WorkspaceService();
  const viewModel = service.loadTeamViewModel() as TeamViewModel;
  return <TeamRenderer viewModel={viewModel} />;
}

