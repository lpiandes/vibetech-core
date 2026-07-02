"use client";

import { useContext } from "react";
import { TeamViewModelContext } from "./TeamContext";

function statusLabel(status: string) {
  // Presentation-only: translate adapter status into user-facing copy.
  switch (status) {
    case "critical":
      return "Critical";
    case "needs_attention":
      return "Needs attention";
    case "healthy":
    default:
      return "Healthy";
  }
}

export default function DepartmentRenderer() {
  const viewModel = useContext<any | null>(TeamViewModelContext);
  if (!viewModel) return null;

  const departments = Array.isArray(viewModel.departments) ? viewModel.departments : [];
  const empty = departments.length === 0;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Departments</div>
          <div className="mt-1 text-xs text-muted-foreground">Coverage and work distribution</div>
        </div>
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No departments have been configured yet.
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map((d: any) => {
            const memberCount = Number(d.memberCount ?? 0);
            const status = String(d.status ?? "");
            return (
              <div key={String(d.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{String(d.name ?? "")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{String(d.summary ?? "")}</div>
                  </div>
                  <div className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                    {statusLabel(status)}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <div>{memberCount} member(s)</div>
                  {Number(d.activeCount ?? 0) > 0 ? <div>{String(d.activeCount)} active</div> : null}
                  {Number(d.blockedCount ?? 0) > 0 ? <div>{String(d.blockedCount)} blocked</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

