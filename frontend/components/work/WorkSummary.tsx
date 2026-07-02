"use client";

import { useContext } from "react";
import { WorkViewModelContext } from "./WorkContext";

export default function WorkSummary() {
  const viewModel = useContext<any | null>(WorkViewModelContext);
  if (!viewModel) return null;

  const metrics = viewModel.metrics ?? {};
  const attention = viewModel.attention ?? {};
  const recs = Array.isArray(viewModel.recommendedActions) ? viewModel.recommendedActions : [];

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Work</div>
          <div className="mt-2 text-base font-semibold leading-tight">
            {String(viewModel.summary ?? "").trim() || "Work overview"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {recs.length > 0 ? `${recs.length} recommendation(s) queued.` : "Your work is progressing normally."}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {Array.isArray(attention.items) && attention.items.length > 0
              ? `${attention.items.length} attention item(s)`
              : "No work requires immediate attention."}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Total work</div>
            <div className="mt-2 text-2xl font-semibold">{String(metrics.totalWork ?? 0)}</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Open work</div>
            <div className="mt-2 text-2xl font-semibold">{String(metrics.openWork ?? 0)}</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Completed</div>
            <div className="mt-2 text-2xl font-semibold">{String(metrics.completedWork ?? 0)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

