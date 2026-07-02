import { useContext } from "react";
import { CapabilityViewModelContext } from "./CapabilityContext";

export default function CapabilitySummary() {
  const vm = useContext(CapabilityViewModelContext);
  const summaryText = vm?.coverage?.coverageSummary ?? "";
  const overall = vm?.overallReadiness ?? 0;
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-sm font-semibold">Overall readiness</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-bold">{overall}%</div>
        <div className="text-sm text-muted-foreground">{summaryText}</div>
      </div>
    </section>
  );
}

