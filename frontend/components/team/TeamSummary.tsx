"use client";

import { useContext } from "react";
import { TeamViewModelContext } from "./TeamContext";

export default function TeamSummary() {
  const viewModel = useContext<any | null>(TeamViewModelContext);
  if (!viewModel) return null;

  const wl = viewModel.workload ?? {};
  const rec = Array.isArray(viewModel.recommendations) ? viewModel.recommendations : [];
  const members = Array.isArray(viewModel.members) ? viewModel.members : [];
  const totalCapacity = members.reduce((sum: number, m: any) => sum + Number(m?.capacity ?? 0), 0);
  const totalMembers = members.length;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Team</div>
          <div className="mt-2 text-base font-semibold leading-tight">
            {String(viewModel.summary ?? "").trim() || "Team overview"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {rec.length > 0 ? `${rec.length} recommendation(s) queued.` : "Everything is running smoothly."}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Utilization</div>
            <div className="mt-2 text-2xl font-semibold">{String(wl.utilization ?? 0)}%</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Capacity</div>
            <div className="mt-2 text-2xl font-semibold">{String(totalCapacity)}</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Availability</div>
            <div className="mt-2 text-2xl font-semibold">
              {String(wl.availableMembers ?? 0)} / {String(totalMembers)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

