import AnalyticsKPIRenderer from "./AnalyticsKPIRenderer";
import AnalyticsTrendRenderer from "./AnalyticsTrendRenderer";
import AnalyticsInsightRenderer from "./AnalyticsInsightRenderer";
import AnalyticsRecommendationRenderer from "./AnalyticsRecommendationRenderer";
import AnalyticsSummary from "./AnalyticsSummary";

import { useContext } from "react";
import { AnalyticsViewModelContext } from "./AnalyticsContext";

export default function AnalyticsLayout() {
  const vm = useContext(AnalyticsViewModelContext);
  const metrics = Array.isArray(vm?.metrics) ? vm?.metrics : [];

  return (
    <div className="space-y-4">
      <AnalyticsSummary />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnalyticsKPIRenderer />
        <AnalyticsTrendRenderer />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnalyticsInsightRenderer />
        <AnalyticsRecommendationRenderer />
      </div>
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="text-sm font-semibold">Metrics</div>
        {metrics.length === 0 ? (
          <div className="mt-3 text-sm text-muted-foreground">Performance data will appear as the business operates.</div>
        ) : (
          <div className="mt-4 space-y-2">
            {metrics.map((m: any, idx: number) => (
              <div key={String(m.metricId ?? m.id ?? idx)} className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground/90">{String(m.metricId ?? m.id ?? "")}</div>
                <div className="text-sm text-muted-foreground">
                  {String(m.category ?? "")}: <span className="text-foreground">{String(m.value ?? 0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

