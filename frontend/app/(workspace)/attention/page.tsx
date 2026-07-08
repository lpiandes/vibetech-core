import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import MissionControlContextProvider from "@/components/mission-control/MissionControlContext";
import AttentionExecutiveLayout from "@/components/attention/AttentionExecutiveLayout";

export default async function AttentionPage() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const service = getWorkspaceService();
  const viewModel = service.loadAttentionViewModel();
  return (
    <MissionControlContextProvider viewModel={viewModel}>
      <AttentionExecutiveLayout />
    </MissionControlContextProvider>
  );
}
