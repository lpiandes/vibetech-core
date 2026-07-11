import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import BusinessIntelligenceWorkspace from "@/components/business-intelligence/BusinessIntelligenceWorkspace";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function BusinessIntelligencePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return runTimedPage("intelligence", async () => {
    const { service } = await getAuthorizedWorkspace(businessId);
    const view = service.loadBusinessIntelligenceWorkspace();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(view).length });
    return <BusinessIntelligenceWorkspace view={view as never} />;
  });
}
