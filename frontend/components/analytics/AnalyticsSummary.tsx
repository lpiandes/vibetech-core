import { useContext } from "react";

import { AnalyticsViewModelContext } from "./AnalyticsContext";

export default function AnalyticsSummary() {
  const vm = useContext(AnalyticsViewModelContext);
  const summary = vm?.summary ?? "";
  const overall = vm?.overallPerformance ?? 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-sm font-semibold">Executive performance</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-bold">{overall}%</div>
        <div className="text-sm text-muted-foreground">{summary}</div>
      </div>
    </section>
  );
}

