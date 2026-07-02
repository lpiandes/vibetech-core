import { WorkspaceService } from "@/lib/workspace/WorkspaceService";
import CommunicationRenderer from "@/components/communications/CommunicationRenderer";
import type { CommunicationViewModel } from "@/components/communications/CommunicationContext";

export default async function CommunicationsPage() {
  // Make the route "asynchronous" so Next can display `loading.tsx` during render.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const service = new WorkspaceService();
  const viewModel = service.loadCommunicationViewModel() as CommunicationViewModel;
  return <CommunicationRenderer viewModel={viewModel} />;
}

