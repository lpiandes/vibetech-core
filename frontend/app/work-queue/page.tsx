import WorkQueue from "@/components/queue/WorkQueue";
import { WorkspaceService } from "@/lib/workspace/WorkspaceService";

export default function WorkQueuePage() {
  const service = new WorkspaceService();
  const view = service.loadWorkQueue();
  // `WorkspaceViewAdapter` returns WorkQueue view items already in the UI card contract shape.
  return <WorkQueue items={(view.items ?? []) as any[]} />;
}

