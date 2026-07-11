import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/platformStore";
import RelationshipOperationsIntelligenceLayout from "@/components/performance/RelationshipOperationsIntelligenceLayout";
import AnalyticsWorkspace from "@/components/analytics/AnalyticsWorkspace";
import { composeAnalyticsView } from "@/lib/analytics/composeAnalyticsView.js";
import {
  loadAnalyticsEngineForBusiness,
  collectLiveAnalyticsEvidence,
} from "../../../../../backend/core/analytics/kpi/DurableAnalyticsDefinitions.js";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function PerformancePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("performance", async () => {
    const { service, role } = await getAuthorizedWorkspace(businessId);
    const viewModel = service.loadRelationshipOperationsIntelligence();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });

    let analytics: ReturnType<typeof composeAnalyticsView>;
    try {
      const [installation, knowledgeDocumentCount, members, engine] = await Promise.all([
        platformStore.getBusinessOSInstallation(businessId),
        platformStore.countActiveKnowledgeDocuments(businessId),
        platformStore.listMembershipsForBusiness(businessId),
        loadAnalyticsEngineForBusiness(platformStore, businessId),
      ]);
      const industry = String(
        installation?.configuration?.industry
        ?? "default",
      );

      const evidence = collectLiveAnalyticsEvidence(service, {
        knowledgeDocumentCount,
        memberCount: Array.isArray(members) ? members.length : 0,
      });

      const recommended = (engine as any).recommendAnalytics({
        businessSummary: { industry },
        businessId,
        evidence,
        role: String(role ?? "OWNER"),
      });

      analytics = composeAnalyticsView({
        analyticsModel: recommended.analyticsModel,
        businessOsMapping: recommended.businessOsMapping,
        role: String(role ?? "OWNER"),
      } as any);
    } catch {
      analytics = composeAnalyticsView({
        analyticsModel: null,
        role: String(role ?? "OWNER"),
      } as any);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <AnalyticsWorkspace analytics={analytics as never} />
        <RelationshipOperationsIntelligenceLayout viewModel={viewModel} />
      </div>
    );
  });
}
