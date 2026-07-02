import { useContext } from "react";
import { CapabilityViewModelContext } from "./CapabilityContext";

export default function CapabilityCategoryRenderer() {
  const vm = useContext(CapabilityViewModelContext);
  const categories = (vm?.categories ?? []) as any[];

  if (!categories.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Capability categories</div>
        <div className="mt-2 text-sm text-muted-foreground">No capability categories have been configured yet.</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Capability categories</div>
      <div className="mt-3 space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.summary}</div>
            </div>
            <div className="text-xs rounded-full border px-2 py-1 bg-background">{c.status}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

