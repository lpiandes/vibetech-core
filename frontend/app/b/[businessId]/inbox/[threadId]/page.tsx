import { notFound } from "next/navigation";

import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import CommunicationThreadDetailLayout from "@/components/communications/CommunicationThreadDetailLayout";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function InboxThreadPage({
  params,
}: {
  params: Promise<{ businessId: string; threadId: string }>;
}) {
  const { businessId, threadId } = await params;
  return runTimedPage("inbox-detail", async () => {
    const { service } = await getAuthorizedWorkspace(businessId);
    const detail = service.loadCommunicationThreadDetail(threadId);
    if (!detail) notFound();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(detail).length });

    return <CommunicationThreadDetailLayout businessId={businessId} detail={detail} />;
  });
}
