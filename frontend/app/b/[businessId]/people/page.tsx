import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import EngagementIndexRenderer from "@/components/engagement/EngagementIndexRenderer";

export default async function PeoplePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { service } = await getAuthorizedWorkspace(businessId);
  return <EngagementIndexRenderer index={service.loadEngagementPartyIndex()} />;
}
