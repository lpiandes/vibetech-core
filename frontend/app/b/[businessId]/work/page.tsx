import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import WorkRenderer from "@/components/work/WorkRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function WorkPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("work", async () => {
    const { service } = await getAuthorizedWorkspace(businessId);
    const viewModel = service.loadWorkViewModel();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });
    return <WorkRenderer viewModel={viewModel} />;
  });
}
