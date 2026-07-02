"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import { MissionControlViewModelContext } from "./MissionControlContext";
import { useContext } from "react";

function alertClass(priority: string) {
  switch (priority) {
    case "immediate":
      return "border-red-200 bg-red-50 text-red-800";
    case "soon":
      return "border-yellow-200 bg-yellow-50 text-yellow-900";
    default:
      return "border-border bg-background text-muted-foreground";
  }
}

export default function MissionControlAlertRenderer() {
  const viewModel = useContext<MissionControlViewModel | null>(MissionControlViewModelContext);
  if (!viewModel) return null;

  const alerts = Array.isArray(viewModel.alerts) ? viewModel.alerts : [];
  if (alerts.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      {alerts.map((a: any) => (
        <div key={String(a.id)} className={["rounded-lg border p-3 text-sm", alertClass(String(a.priority ?? ""))].join(" ")}>
          <div className="font-medium">{String(a.title ?? "Alert")}</div>
          <div className="mt-1 text-xs text-muted-foreground">{String(a.summary ?? "")}</div>
        </div>
      ))}
    </div>
  );
}

