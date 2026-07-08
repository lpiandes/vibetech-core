import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import type { EngagementViewModel } from "@/lib/workspace/EngagementTypes";
import EngagementDetailRenderer from "@/components/engagement/EngagementDetailRenderer";

export default async function EngagementPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const service = getWorkspaceService();
  const viewModel = service.loadEngagementViewModel(partyId) as EngagementViewModel;
  return <EngagementDetailRenderer viewModel={viewModel} />;
}
