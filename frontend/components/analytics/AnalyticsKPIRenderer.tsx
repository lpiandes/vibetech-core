import { useContext } from "react";

import { AnalyticsViewModelContext } from "./AnalyticsContext";

function priorityLabel(priority: number) {
  const p = Number(priority);
  if (!Number.isFinite(p)) return "Later";
  if (p >= 80) return "High";
  if (p >= 60) return "Medium";
  return "Low";
}

export default function AnalyticsKPIRenderer() {
  const vm = useContext(AnalyticsViewModelContext);
  const kpis = Array.isArray(vm?.kpis) ? vm?.kpis : [];

  if (kpis.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="text-sm font-semibold">Key performance indicators</div>
        <div className="mt-3 text-sm text-muted-foreground">Performance data will appear as the business operates.</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-sm font-semibold">Key performance indicators</div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {kpis.map((kpi: any) => (
          <div key={String(kpi.kpiId)} className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold">{String(kpi.name ?? "")}</div>
              <div className="text-xs rounded-full border border-border/60 px-2 py-0.5">
                {String(kpi.badge ?? "")}
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold">{String(kpi.value ?? 0)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{priorityLabel(Number(kpi.priority ?? 0))} priority</div>
            <div className="mt-1 text-xs text-muted-foreground">Status: {String(kpi.status ?? "")}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

