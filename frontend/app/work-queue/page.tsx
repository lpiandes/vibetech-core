import WorkQueue from "@/components/queue/WorkQueue";
import { WorkspaceService } from "@/lib/workspace/WorkspaceService";

export default function WorkQueuePage() {
  const service = new WorkspaceService();
  const view = service.loadWorkQueue();
  const items = (view.items ?? []).map((i: any) => ({
    id: i.id,
    title: i.title,
    clientName: i.clientName,
    matterType: i.matterType,
    priority: i.priority,
    status: i.status,
    employee: i.assignedEmployeeName,
    createdTimeISO: i.createdTimeISO,
  }));

  return <WorkQueue items={items} />;
}

