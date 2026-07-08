import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import AudienceDetailRenderer from "@/components/audiences/AudienceDetailRenderer";
import type { AudienceDashboardViewModel } from "@/lib/workspace/AudienceTypes";

export default async function AudienceDetailPage({ params }: { params: Promise<{ segmentId: string }> }) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const { segmentId } = await params;
  const service = getWorkspaceService();
  const dashboard = service.loadAudienceDashboard() as AudienceDashboardViewModel;
  const audience = dashboard.audiences.find((a) => a.segmentId === segmentId) ?? null;
  return <AudienceDetailRenderer dashboard={dashboard} audience={audience} segmentId={segmentId} />;
}
