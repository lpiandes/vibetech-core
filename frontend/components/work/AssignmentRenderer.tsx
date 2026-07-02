"use client";

import { useContext } from "react";
import { WorkViewModelContext } from "./WorkContext";

export default function AssignmentRenderer() {
  const viewModel = useContext<any | null>(WorkViewModelContext);
  if (!viewModel) return null;

  const assignments = Array.isArray(viewModel.assignments) ? viewModel.assignments : [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Assignments</div>
          <div className="mt-1 text-xs text-muted-foreground">Who owns each work item</div>
        </div>
        <div className="text-xs text-muted-foreground">{String(assignments.length)} assignment(s)</div>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          Work is not assigned yet.
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a: any) => (
            <div key={String(a.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{String(a.assigneeName ?? "Unknown")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Work item: {String(a.workItemId ?? "")}</div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{String(a.status ?? "")}</div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Type: {String(a.assigneeType ?? "")} · Assigned at: {String(a.assignedAt ?? "")}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

