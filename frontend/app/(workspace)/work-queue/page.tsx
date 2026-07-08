import WorkQueue from "@/components/queue/WorkQueue";
import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";

export default function WorkQueuePage() {
  const service = getWorkspaceService();
  const view = service.loadWorkQueue();
  // `WorkspaceViewAdapter` returns WorkQueue view items already in the UI card contract shape.
  return <WorkQueue items={(view.items ?? []) as any[]} />;
}

