import { useContext } from "react";
import { CapabilityViewModelContext } from "./CapabilityContext";

export default function CapabilityRecommendationRenderer() {
  const vm = useContext(CapabilityViewModelContext);
  const recs = (vm?.recommendations ?? []) as any[];

  if (!recs.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Recommendations</div>
        <div className="mt-2 text-sm text-muted-foreground">No capability gaps have been identified.</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Recommendations</div>
      <div className="mt-3 space-y-2">
        {recs.map((r) => (
          <div key={r.id} className="rounded-lg border border-border/60 bg-background p-3">
            <div className="text-sm font-medium">{r.type}</div>
            <div className="mt-1 text-xs text-muted-foreground">{r.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

