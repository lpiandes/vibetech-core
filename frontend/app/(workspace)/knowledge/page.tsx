import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import KnowledgeRenderer from "@/components/knowledge/KnowledgeRenderer";
import type { KnowledgeViewModel } from "@/components/knowledge/KnowledgeContext";

export default async function KnowledgePage() {
  // Make the route "asynchronous" so Next can display `loading.tsx` during render.
  // Keep it deterministic and non-blocking.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const service = getWorkspaceService();
  const viewModel = service.loadKnowledgeViewModel() as KnowledgeViewModel;
  return <KnowledgeRenderer viewModel={viewModel} />;
}

