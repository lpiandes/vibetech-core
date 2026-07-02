"use client";

import { useContext } from "react";
import { TeamViewModelContext } from "./TeamContext";

export default function WorkloadRenderer() {
  const viewModel = useContext<any | null>(TeamViewModelContext);
  if (!viewModel) return null;

  const wl = viewModel.workload ?? {};
  const members = Array.isArray(viewModel.members) ? viewModel.members : [];
  const totalCapacity = members.reduce((sum: number, m: any) => sum + Number(m?.capacity ?? 0), 0);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Workload</div>
          <div className="mt-1 text-xs text-muted-foreground">Capacity and throughput overview</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Utilization</div>
          <div className="mt-2 text-2xl font-semibold">{String(wl.utilization ?? 0)}%</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Capacity</div>
          <div className="mt-2 text-2xl font-semibold">{String(totalCapacity)}</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Assigned work</div>
          <div className="mt-2 text-2xl font-semibold">{String(wl.totalAssignedWork ?? 0)}</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Pending work</div>
          <div className="mt-2 text-2xl font-semibold">{String(wl.totalPendingWork ?? 0)}</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:col-span-2">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Completed work</div>
          <div className="mt-2 text-2xl font-semibold">{String(wl.totalCompletedWork ?? 0)}</div>
        </div>
      </div>
    </section>
  );
}

