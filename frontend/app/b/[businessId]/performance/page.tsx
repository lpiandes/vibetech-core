import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import RelationshipOperationsIntelligenceLayout from "@/components/performance/RelationshipOperationsIntelligenceLayout";

export default async function PerformancePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { service } = await getAuthorizedWorkspace(businessId);
  return <RelationshipOperationsIntelligenceLayout viewModel={service.loadRelationshipOperationsIntelligence()} />;
}
