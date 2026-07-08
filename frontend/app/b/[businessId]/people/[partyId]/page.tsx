import { notFound } from "next/navigation";

import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import PeopleDetailRenderer from "@/components/people/PeopleDetailRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function PeopleDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; partyId: string }>;
}) {
  const { businessId, partyId } = await params;

  return runTimedPage("people-detail", async () => {
    const { service } = await getAuthorizedWorkspace(businessId);

    let viewModel;
    try {
      viewModel = service.loadEngagementViewModel(partyId);
    } catch {
      notFound();
    }

    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });
    return <PeopleDetailRenderer businessId={businessId} viewModel={viewModel} />;
  });
}
