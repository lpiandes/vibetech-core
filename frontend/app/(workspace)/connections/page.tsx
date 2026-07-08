import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import ConnectionsRenderer from "@/components/connections/ConnectionsRenderer";

export default async function ConnectionsPage() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const service = getWorkspaceService();
  const viewModel = service.loadConnectionCenterViewModel();
  return <ConnectionsRenderer viewModel={viewModel} />;
}
