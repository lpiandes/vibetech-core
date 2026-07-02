"use client";

import { useContext } from "react";
import { WorkViewModelContext } from "./WorkContext";

function statusStyle(status: string) {
  switch (String(status)) {
    case "blocked":
      return "bg-red-50 text-red-700 border-red-200";
    case "review_required":
      return "bg-yellow-50 text-yellow-800 border-yellow-200";
    case "completed":
      return "bg-green-50 text-green-700 border-green-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default function QueueRenderer() {
  const viewModel = useContext<any | null>(WorkViewModelContext);
  if (!viewModel) return null;

  const queues = Array.isArray(viewModel.queues) ? viewModel.queues : [];
  if (queues.length === 0) {
    return (
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Queues</div>
            <div className="mt-1 text-xs text-muted-foreground">Work routing and attention boundaries</div>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No work queues have been configured.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Queues</div>
          <div className="mt-1 text-xs text-muted-foreground">Where work waits for attention</div>
        </div>
      </div>

      <div className="space-y-3">
        {queues.map((q: any) => (
          <div key={String(q.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{String(q.name ?? "")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{String(q.summary ?? "")}</div>
              </div>
              <div className="shrink-0 rounded-full border px-3 py-1 text-xs text-muted-foreground bg-background">
                {String(q.itemCount ?? 0)} item(s)
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className={["inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium", statusStyle(q.status ?? "")].join(" ")}>
                {String(q.status ?? "open")}
              </span>
              {Array.isArray(q.actions) && q.actions.length > 0 ? (
                <span className="text-xs text-muted-foreground">{q.actions.length} action(s)</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

