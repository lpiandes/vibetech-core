"use client";

import { useContext } from "react";
import { KnowledgeViewModelContext } from "./KnowledgeContext";
import EmptyState from "@/components/design-system/EmptyState";

export default function KnowledgeRecommendationRenderer() {
  const viewModel = useContext<any | null>(KnowledgeViewModelContext);
  if (!viewModel) return null;

  const recs = Array.isArray(viewModel.recommendations) ? viewModel.recommendations : [];
  const empty = recs.length === 0;

  if (empty) {
    return (
      <section>
        <div className="mb-4 text-sm font-semibold">Recommendations</div>
        <EmptyState
          icon={null}
          title="No recommendations at this time."
          description="When readiness changes, recommendations will appear here."
        />
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 text-sm font-semibold">Recommendations</div>
      <div className="space-y-3">
        {recs.map((r: any) => (
          <div key={String(r.id ?? r.label)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="text-sm font-semibold">{String(r.label ?? "")}</div>
            <div className="mt-1 text-xs text-muted-foreground">{String(r.summary ?? "")}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

