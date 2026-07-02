"use client";

import { useContext } from "react";
import type { RequestViewModel } from "./RequestContext";
import { RequestViewModelContext } from "./RequestContext";

function priorityStyle(priority: string) {
  const p = String(priority ?? "").toLowerCase();
  if (p === "immediate") return "bg-red-50 text-red-700 border-red-200";
  if (p === "soon") return "bg-yellow-50 text-yellow-800 border-yellow-200";
  return "bg-muted text-muted-foreground border-border";
}

export default function RequestRecommendationRenderer() {
  const viewModel = useContext<RequestViewModel | null>(RequestViewModelContext);
  if (!viewModel) return null;

  const actions = Array.isArray(viewModel.recommendedActions) ? viewModel.recommendedActions : [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Recommendations</div>
          <div className="mt-1 text-xs text-muted-foreground">Business actions based on request signals</div>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No recommendations at this time.
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((a: any) => (
            <div key={String(a.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{String(a.label ?? a.type ?? "")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{String(a.type ?? "")}</div>
                </div>
                <div className={["shrink-0 rounded-full border px-3 py-1 text-xs font-medium", priorityStyle(a.priority)].join(" ")}>
                  {String(a.priority ?? "")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

