import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import AnalyticsRenderer from "@/components/analytics/AnalyticsRenderer";

export default async function PerformancePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { service } = await getAuthorizedWorkspace(businessId);
  return <AnalyticsRenderer viewModel={service.loadAnalyticsViewModel()} />;
}
