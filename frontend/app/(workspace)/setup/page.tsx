import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import SetupRenderer from "@/components/setup/SetupRenderer";

export default async function SetupPage() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const service = getWorkspaceService();
  const viewModel = service.loadSetupViewModel();
  return <SetupRenderer viewModel={viewModel} />;
}
