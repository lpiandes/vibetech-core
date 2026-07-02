"use client";

import { useContext } from "react";
import { TeamViewModelContext } from "./TeamContext";

export default function RecommendationRenderer() {
  const viewModel = useContext<any | null>(TeamViewModelContext);
  if (!viewModel) return null;

  const recs = Array.isArray(viewModel.recommendations) ? viewModel.recommendations : [];
  const empty = recs.length === 0;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Recommendations</div>
          <div className="mt-1 text-xs text-muted-foreground">Business actions to take next</div>
        </div>
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          Everything is running smoothly.
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map((r: any) => (
            <div key={String(r.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{String(r.label ?? "")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {String(r.type ?? "")} · {String(r.target ?? "")}
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                  {String(r.priority ?? "")}
                </div>
              </div>
              {Boolean(r.disabled) ? (
                <div className="mt-2 text-xs text-muted-foreground">Disabled</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

