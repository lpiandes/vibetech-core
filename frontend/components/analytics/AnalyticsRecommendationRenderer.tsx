import { useContext } from "react";

import { AnalyticsViewModelContext } from "./AnalyticsContext";

export default function AnalyticsRecommendationRenderer() {
  const vm = useContext(AnalyticsViewModelContext);
  const recs = Array.isArray(vm?.recommendations) ? vm?.recommendations : [];

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-sm font-semibold">Recommendations</div>
      {recs.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">No recommendations at this time.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {recs.map((rec: any) => (
            <div key={String(rec.recommendationId)} className="rounded-lg border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{String(rec.title ?? "")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Action: {String(rec.actionType ?? "")}</div>
                </div>
                <div className="text-xs rounded-full border border-border/60 px-2 py-0.5">Priority: {String(rec.priority ?? "")}</div>
              </div>
              <div className="mt-2 text-sm">{String(rec.recommendation ?? "")}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

