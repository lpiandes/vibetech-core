import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import type { EngagementPartyIndexViewModel } from "@/lib/workspace/EngagementTypes";
import EngagementIndexRenderer from "@/components/engagement/EngagementIndexRenderer";

export default function EngagementIndexPage() {
  const service = getWorkspaceService();
  const index = service.loadEngagementPartyIndex() as EngagementPartyIndexViewModel;
  return <EngagementIndexRenderer index={index} />;
}
