import { useContext } from "react";
import { CapabilityViewModelContext } from "./CapabilityContext";

export default function CapabilityProviderRenderer() {
  const vm = useContext(CapabilityViewModelContext);
  const providers = (vm?.providers ?? []) as any[];

  if (!providers.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Providers</div>
        <div className="mt-2 text-sm text-muted-foreground">No providers have been detected yet.</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Providers</div>
      <div className="mt-3 space-y-2">
        {providers.map((p) => (
          <div key={p.providerType} className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">{p.providerType}</div>
              <div className="text-xs text-muted-foreground">
                {p.capabilityCountCovered}/{p.capabilityCountRequired} covered
              </div>
            </div>
            <div className="text-xs rounded-full border px-2 py-1 bg-background">{p.status}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

