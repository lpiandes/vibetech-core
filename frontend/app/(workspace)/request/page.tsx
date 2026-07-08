import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import RequestRenderer from "@/components/request/RequestRenderer";
import type { RequestViewModel } from "@/components/request/RequestContext";

export default async function RequestPage() {
  // Make the route "asynchronous" so Next can display `loading.tsx` during render.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const service = getWorkspaceService();
  const viewModel = service.loadRequestViewModel() as RequestViewModel;

  return <RequestRenderer viewModel={viewModel} />;
}

