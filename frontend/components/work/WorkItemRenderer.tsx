"use client";

import { useContext } from "react";
import { WorkViewModelContext } from "./WorkContext";

function badgeClasses(badge: string) {
  const b = String(badge ?? "").toLowerCase();
  if (b.includes("blocked")) return "bg-red-50 text-red-700 border-red-200";
  if (b.includes("failed")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (b.includes("review")) return "bg-yellow-50 text-yellow-800 border-yellow-200";
  if (b.includes("overdue")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (b.includes("unassigned")) return "bg-muted text-muted-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
}

export default function WorkItemRenderer() {
  const viewModel = useContext<any | null>(WorkViewModelContext);
  if (!viewModel) return null;

  const items = Array.isArray(viewModel.items) ? viewModel.items : [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Work items</div>
          <div className="mt-1 text-xs text-muted-foreground">Current units of business work</div>
        </div>
        <div className="text-xs text-muted-foreground">{String(items.length)} item(s)</div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No work requires immediate attention.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it: any) => (
            <div key={String(it.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{String(it.title ?? "")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {String(it.queue?.name ?? "")} · {String(it.stage?.name ?? "")}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{String(it.status ?? "")}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                  {String(it.priority ?? "")}
                </span>
                {Array.isArray(it.badges) && it.badges.length > 0
                  ? it.badges.slice(0, 4).map((b: any) => (
                      <span key={String(b)} className={["inline-flex items-center rounded-full border px-2 py-1 text-xs", badgeClasses(String(b))].join(" ")}>
                        {String(b)}
                      </span>
                    ))
                  : null}
                {Boolean(it.attentionRequired) ? (
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">
                    Attention required
                  </span>
                ) : null}
              </div>

              {it.blockedReason ? <div className="mt-2 text-xs text-muted-foreground">Blocked: {String(it.blockedReason)}</div> : null}
              {it.assignedTo ? <div className="mt-1 text-xs text-muted-foreground">Owner: {String(it.assignedTo)}</div> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

