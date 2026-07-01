import ReviewWorkspace from "@/components/review/ReviewWorkspace";
import { WorkspaceService } from "@/lib/workspace/WorkspaceService";

export default async function ReviewWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const service = new WorkspaceService();
  const reviewWork = await service.loadReviewWork(resolvedParams.id);
  return <ReviewWorkspace workItemId={resolvedParams.id} reviewWork={reviewWork} />;
}

