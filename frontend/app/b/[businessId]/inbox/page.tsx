import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import CommunicationRenderer from "@/components/communications/CommunicationRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function InboxPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("inbox", async () => {
    const { service } = await getAuthorizedWorkspace(businessId);
    const viewModel = service.loadCommunicationViewModel({ includeProductContext: false });
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });
    return <CommunicationRenderer viewModel={viewModel} />;
  });
}
