"use client";

import { useContext } from "react";
import type { RequestViewModel } from "./RequestContext";
import { RequestViewModelContext } from "./RequestContext";
import RequestItemRenderer from "./RequestItemRenderer";

function queueStatusPill(status: string) {
  const s = String(status ?? "").toLowerCase();
  if (s === "needs_attention") return "bg-yellow-50 text-yellow-800 border-yellow-200";
  if (s === "completed") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  return "bg-muted text-muted-foreground border-border";
}

export default function RequestQueueRenderer() {
  const viewModel = useContext<RequestViewModel | null>(RequestViewModelContext);
  if (!viewModel) return null;

  const queues = Array.isArray(viewModel.queues) ? viewModel.queues : [];
  const items = Array.isArray(viewModel.items) ? viewModel.items : [];

  const itemsById = new Map(items.map((it: any) => [String(it.id), it]));

  if (queues.length === 0) {
    return (
      <section>
        <div className="mb-4 text-sm font-semibold">Queues</div>
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No incoming requests.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Queues</div>
          <div className="mt-1 text-xs text-muted-foreground">Requests grouped by lifecycle</div>
        </div>
      </div>

      <div className="space-y-4">
        {queues.map((q: any) => {
          const queueItems = Array.isArray(q.items) ? q.items : [];
          const itemViews = queueItems.map((id: string) => itemsById.get(String(id))).filter(Boolean);
          const actions = Array.isArray(q.actions) ? q.actions : [];

          return (
            <div key={String(q.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{String(q.name ?? "")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{String(q.summary ?? "")}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={["shrink-0 rounded-full border px-3 py-1 text-xs font-medium", queueStatusPill(q.status)].join(" ")}>
                    {String(q.status ?? "")}
                  </div>
                  <div className="text-xs text-muted-foreground">{String(q.itemCount ?? itemViews.length)} item(s)</div>
                </div>
              </div>

              {actions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {actions.map((a: any) => (
                    <span key={String(a.id)} className="rounded-full border border-border bg-background px-3 py-1 text-xs">
                      {String(a.label ?? a.type ?? "")}
                    </span>
                  ))}
                </div>
              ) : null}

              {itemViews.length === 0 ? null : (
                <div className="mt-4 space-y-3">
                  {itemViews.map((it: any) => (
                    <RequestItemRenderer key={String(it.id)} item={it} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

