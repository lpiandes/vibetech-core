import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import AutomationsRenderer from "@/components/automations/AutomationsRenderer";

export default async function AutomationsPage() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const service = getWorkspaceService();
  const viewModel = await service.loadAutomationCenterViewModel();
  return <AutomationsRenderer viewModel={viewModel} />;
}
