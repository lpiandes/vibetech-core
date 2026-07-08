import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import AudienceIndexRenderer from "@/components/audiences/AudienceIndexRenderer";
import type { AudienceDashboardViewModel } from "@/lib/workspace/AudienceTypes";

export default async function AudiencesPage() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const service = getWorkspaceService();
  const dashboard = service.loadAudienceDashboard() as AudienceDashboardViewModel;
  return <AudienceIndexRenderer dashboard={dashboard} />;
}
