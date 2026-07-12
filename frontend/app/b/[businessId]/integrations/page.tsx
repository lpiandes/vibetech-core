import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import ConnectionsRenderer from "@/components/connections/ConnectionsRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

/**
 * Owner Integrations surface — connections to operate with.
 * Integration hub schema / capability panels stay out of the operating shell.
 */
export default async function IntegrationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("integrations", async () => {
    const [{ service }, knowledgeDocumentCount] = await Promise.all([
      getAuthorizedWorkspace(businessId),
      platformStore.countActiveKnowledgeDocuments(businessId),
    ]);
    markRequestTiming("KNOWLEDGE_DB");
    service.refreshOperationalState(knowledgeDocumentCount);
    const viewModel = service.loadConnectionCenterViewModel();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });

    return <ConnectionsRenderer viewModel={viewModel} />;
  });
}
