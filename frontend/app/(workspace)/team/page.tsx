import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import TeamRenderer from "@/components/team/TeamRenderer";
import type { TeamViewModel } from "@/components/team/TeamContext";

export default function TeamPage() {
  const service = getWorkspaceService();
  const viewModel = service.loadTeamViewModel() as TeamViewModel;
  return <TeamRenderer viewModel={viewModel} />;
}

