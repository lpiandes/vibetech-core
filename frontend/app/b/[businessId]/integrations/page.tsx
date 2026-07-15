import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import { liveIntegrationAvailability } from "@/lib/server/liveIntegrations";
import ConnectionsRenderer from "@/components/connections/ConnectionsRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

/**
 * Owner Integrations surface — connections that can operate this business.
 * Prefer Business OS integration plan over industry-package catalogs.
 * Only lists integrations that can actually connect (no coming-soon rows).
 */
export default async function IntegrationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("integrations", async () => {
    const [{ service }, knowledgeDocumentCount, osInstallation] = await Promise.all([
      getAuthorizedWorkspace(businessId),
      platformStore.countActiveKnowledgeDocuments(businessId),
      platformStore.getBusinessOSInstallation(businessId),
    ]);
    markRequestTiming("KNOWLEDGE_DB");
    service.refreshOperationalState(knowledgeDocumentCount);

    const businessOsIntegrations = Array.isArray(osInstallation?.configuration?.integrations)
      ? osInstallation.configuration.integrations
      : Array.isArray(osInstallation?.configuration?.integrationRequirements)
        ? osInstallation.configuration.integrationRequirements
        : null;

    const viewModel = service.loadConnectionCenterViewModel({
      businessOsIntegrations,
      liveFlags: liveIntegrationAvailability(),
    });
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });

    return <ConnectionsRenderer viewModel={viewModel} />;
  });
}
