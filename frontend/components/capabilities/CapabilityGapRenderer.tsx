import { useContext } from "react";
import { CapabilityViewModelContext } from "./CapabilityContext";

export default function CapabilityGapRenderer() {
  const vm = useContext(CapabilityViewModelContext);
  const gaps = (vm?.gaps ?? []) as any[];

  if (!gaps.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Capability gaps</div>
        <div className="mt-2 text-sm text-muted-foreground">Your capabilities are fully covered.</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Capability gaps</div>
      <div className="mt-3 space-y-2">
        {gaps.map((g) => (
          <div key={g.id} className="rounded-lg border border-border/60 bg-background p-3">
            <div className="text-sm font-medium">{g.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{g.reason}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

