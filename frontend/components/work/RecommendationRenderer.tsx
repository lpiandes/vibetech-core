"use client";

import { useContext } from "react";
import { WorkViewModelContext } from "./WorkContext";

export default function RecommendationRenderer() {
  const viewModel = useContext<any | null>(WorkViewModelContext);
  if (!viewModel) return null;

  const recs = Array.isArray(viewModel.recommendedActions) ? viewModel.recommendedActions : [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Recommendations</div>
          <div className="mt-1 text-xs text-muted-foreground">What should happen next</div>
        </div>
      </div>

      {recs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          Your work is progressing normally.
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map((r: any) => (
            <div key={String(r.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{String(r.label ?? "")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {String(r.type ?? "")} · target: {String(r.target ?? "")}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{String(r.priority ?? "")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

