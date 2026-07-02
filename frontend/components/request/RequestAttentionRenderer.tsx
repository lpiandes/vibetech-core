"use client";

import { useContext } from "react";
import type { RequestViewModel } from "./RequestContext";
import { RequestViewModelContext } from "./RequestContext";

function priorityBadge(priority: string) {
  const p = String(priority ?? "").toLowerCase();
  if (p === "immediate") return "bg-red-50 text-red-700 border-red-200";
  if (p === "soon") return "bg-yellow-50 text-yellow-800 border-yellow-200";
  return "bg-muted text-muted-foreground border-border";
}

export default function RequestAttentionRenderer() {
  const viewModel = useContext<RequestViewModel | null>(RequestViewModelContext);
  if (!viewModel) return null;

  const attention = viewModel.attention ?? {};
  const items = Array.isArray(attention.items) ? attention.items : [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Attention</div>
          <div className="mt-1 text-xs text-muted-foreground">Which requests need action right now</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No requests require immediate attention.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it: any) => (
            <div key={String(it.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{String(it.summary ?? "")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{String(it.category ?? "")}</div>
                </div>
                <div className={["shrink-0 rounded-full border px-3 py-1 text-xs font-medium", priorityBadge(it.priority)].join(" ")}>
                  {String(it.priority ?? "")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

