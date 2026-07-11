import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import EngagementIndexRenderer from "@/components/engagement/EngagementIndexRenderer";
import ModuleRenderer from "@/components/workspace/ModuleRenderer";

export default async function PeoplePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const { service } = await getAuthorizedWorkspace(businessId);
  return (
    <ModuleRenderer moduleId="people">
      <EngagementIndexRenderer index={service.loadEngagementPartyIndex()} />
    </ModuleRenderer>
  );
}
