 "use client";

import { ChevronRight } from "lucide-react";

import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";

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
      className="group cursor-pointer rounded-2xl border border-border bg-background px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      role="button"
      tabIndex={0}
      aria-label={`${item.title} for ${item.clientName}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {item.title}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {item.clientName} • {item.matterType}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="text-xs text-muted-foreground">
              Employee:{" "}
              <span className="font-medium text-foreground">{item.employee}</span>
            </div>
            <PriorityBadge priority={item.priority} />
            <StatusBadge status={item.status} />
            <div className="text-xs text-muted-foreground">{relative}</div>
          </div>
        </div>

        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground shadow-sm transition group-hover:bg-foreground/5">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

