import { useContext } from "react";

import { AnalyticsViewModelContext } from "./AnalyticsContext";

function severityLabel(severity: number) {
  const s = Number(severity);
  if (!Number.isFinite(s)) return "Low";
  if (s >= 80) return "High";
  if (s >= 40) return "Medium";
  return "Low";
}

export default function AnalyticsTrendRenderer() {
  const vm = useContext(AnalyticsViewModelContext);
  const trends = Array.isArray(vm?.trends) ? vm?.trends : [];

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-sm font-semibold">Trends</div>
      {trends.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">Performance trend data will appear as the business operates.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {trends.map((t: any) => (
            <div key={String(t.trendId)} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card p-4">
              <div>
                <div className="text-sm font-semibold">{String(t.kpiId ?? "")}</div>
                <div className="mt-1 text-sm text-muted-foreground">Direction: {String(t.direction ?? "")}</div>
                <div className="mt-1 text-xs text-muted-foreground">Icon: {String(t.icon ?? "")}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{severityLabel(Number(t.severity ?? 0))}</div>
                <div className="mt-1 text-xs text-muted-foreground">Severity: {String(t.severity ?? "")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

