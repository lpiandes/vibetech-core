import { useContext } from "react";

import { AnalyticsViewModelContext } from "./AnalyticsContext";

function importanceLabel(importance: string) {
  const imp = String(importance ?? "").toLowerCase();
  if (imp === "high") return "High";
  if (imp === "medium") return "Medium";
  if (imp === "low") return "Low";
  return "Low";
}

export default function AnalyticsInsightRenderer() {
  const vm = useContext(AnalyticsViewModelContext);
  const insights = Array.isArray(vm?.insights) ? vm?.insights : [];

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-sm font-semibold">Insights</div>
      {insights.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">No analytics insights require attention.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {insights.map((ins: any) => (
            <div key={String(ins.insightId)} className="rounded-lg border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{String(ins.title ?? "")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Category: {String(ins.category ?? "")}</div>
                </div>
                <div className="text-xs rounded-full border border-border/60 px-2 py-0.5">{importanceLabel(String(ins.importance ?? ""))}</div>
              </div>
              <div className="mt-2 text-sm">{String(ins.message ?? "")}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

