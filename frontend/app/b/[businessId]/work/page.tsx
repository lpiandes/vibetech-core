import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import WorkRenderer from "@/components/work/WorkRenderer";
import ModuleRenderer from "@/components/workspace/ModuleRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

/**
 * Owner Work surface — active work queue only.
 * Workflow schema / assembly stays in Architect, not the operating shell.
 */
export default async function WorkPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("work", async () => {
    const { service } = await getAuthorizedWorkspace(businessId);
    const viewModel = service.loadWorkViewModel();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });

    return (
      <ModuleRenderer moduleId="work">
        <WorkRenderer viewModel={viewModel} />
      </ModuleRenderer>
    );
  });
}
