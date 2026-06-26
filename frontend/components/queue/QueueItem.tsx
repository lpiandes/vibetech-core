 "use client";

import { ChevronRight } from "lucide-react";

import Avatar from "@/components/design-system/Avatar";
import PrimaryButton from "@/components/design-system/PrimaryButton";
import PriorityBadge from "@/components/design-system/PriorityBadge";
import StatusBadge from "@/components/design-system/StatusBadge";

export type QueueItemModel = {
  id: string;
  title: string;
  clientName: string;
  matterType: string;
  priority: "Low" | "Medium" | "High";
  status: "Needs Review" | "Approved" | "Completed";
  employee: string;
  createdTimeISO: string;
};

function formatRelativeTime(iso: string) {
  const created = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - created;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay >= 1) return `${diffDay}d ago`;
  if (diffHr >= 1) return `${diffHr}h ago`;
  if (diffMin >= 1) return `${diffMin}m ago`;
  return "Just now";
}

export default function QueueItem({ item }: { item: QueueItemModel }) {
  const relative = formatRelativeTime(item.createdTimeISO);

  return (
    <div
      className="group cursor-pointer rounded-3xl border border-border bg-background px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      role="button"
      tabIndex={0}
      aria-label={`${item.title} for ${item.clientName}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold tracking-tight text-foreground">
            {item.clientName}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {item.matterType}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Avatar name={item.employee} size={32} />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                Assigned Digital Employee
              </div>
              <div className="truncate text-sm font-medium text-foreground">
                {item.employee}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PriorityBadge priority={item.priority} />
            <StatusBadge status={item.status} />
            <div className="text-xs text-muted-foreground">
              Created: {relative}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-end">
          <PrimaryButton type="button" className="h-10 rounded-2xl px-4">
            <span className="inline-flex items-center gap-2">
              Review Work <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

