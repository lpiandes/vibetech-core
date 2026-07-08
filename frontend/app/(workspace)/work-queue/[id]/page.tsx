import ReviewWorkspace from "@/components/review/ReviewWorkspace";
import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";

export default async function ReviewWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const service = getWorkspaceService();
  const reviewWork = await service.loadReviewWork(resolvedParams.id);
  return <ReviewWorkspace workItemId={resolvedParams.id} reviewWork={reviewWork} />;
}

