import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import ConnectionsRenderer from "@/components/connections/ConnectionsRenderer";
import IntegrationWorkspace from "@/components/integrations/IntegrationWorkspace";
import { composeIntegrationView } from "@/lib/integrations/composeIntegrationView.js";
import { IntegrationHubEngine } from "../../../../../backend/core/integrations/hub/IntegrationHubEngine.js";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

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

    let integrations: ReturnType<typeof composeIntegrationView>;
    try {
      const installation = await platformStore.getBusinessOSInstallation(businessId);
      const configuration = installation?.configuration ?? null;
      let specification: any = null;
      if (installation?.specificationId) {
        const specRow = await platformStore.getBusinessOSSpecification({
          businessId,
          specificationId: installation.specificationId,
        });
        specification = specRow?.specification ?? null;
      }

      const industry = String(specification?.industry ?? configuration?.industry ?? "default");

      if (configuration?.integrations?.integrationRequirements?.length) {
        integrations = composeIntegrationView({
          configuration,
          businessOsMapping: configuration.integrations,
          connectionCenter: viewModel,
        } as any);
      } else {
        const recommended = (new IntegrationHubEngine() as any).recommendIntegrations({
          businessSummary: { industry },
          businessId,
        });
        integrations = composeIntegrationView({
          integrationModel: recommended.integrationModel,
          businessOsMapping: recommended.businessOsMapping,
          connectionCenter: viewModel,
        } as any);
      }
    } catch {
      const recommended = (new IntegrationHubEngine() as any).recommendIntegrations({
        businessSummary: { industry: "default" },
        businessId,
      });
      integrations = composeIntegrationView({
        integrationModel: recommended.integrationModel,
        businessOsMapping: recommended.businessOsMapping,
      } as any);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <IntegrationWorkspace integrations={integrations as never} />
        <ConnectionsRenderer viewModel={viewModel} />
      </div>
    );
  });
}
