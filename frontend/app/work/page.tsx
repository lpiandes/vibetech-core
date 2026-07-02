import { WorkspaceService } from "@/lib/workspace/WorkspaceService";
import WorkRenderer from "@/components/work/WorkRenderer";
import type { WorkViewModel } from "@/components/work/WorkContext";

export default async function WorkPage() {
  // Make the route "asynchronous" so Next can display `loading.tsx` during render.
  // Keep it deterministic and non-blocking.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const service = new WorkspaceService();
  const viewModel = service.loadWorkViewModel() as WorkViewModel;
  return <WorkRenderer viewModel={viewModel} />;
}

