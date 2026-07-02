"use client";

import { useContext } from "react";
import { WorkViewModelContext } from "./WorkContext";

export default function StageRenderer() {
  const viewModel = useContext<any | null>(WorkViewModelContext);
  if (!viewModel) return null;

  const stages = Array.isArray(viewModel.stages) ? viewModel.stages : [];
  if (stages.length === 0) {
    return (
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Stages</div>
            <div className="mt-1 text-xs text-muted-foreground">No work stages are configured</div>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No work stages have been configured.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Stages</div>
          <div className="mt-1 text-xs text-muted-foreground">Work progress in the process</div>
        </div>
      </div>

      <div className="space-y-3">
        {stages.map((s: any) => (
          <div key={String(s.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{String(s.name ?? "")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{String(s.summary ?? "")}</div>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {String(s.itemCount ?? 0)} item(s)
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                {String(s.status ?? "open")}
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                order: {String(s.sortOrder ?? 0)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

