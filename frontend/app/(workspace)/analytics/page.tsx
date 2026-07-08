import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";

import AnalyticsRenderer from "@/components/analytics/AnalyticsRenderer";

export default async function AnalyticsPage() {
  // Make the route "asynchronous" so Next can display `loading.tsx` during render.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const service = getWorkspaceService();
  const viewModel = service.loadAnalyticsViewModel() as any;
  return <AnalyticsRenderer viewModel={viewModel} />;
}

