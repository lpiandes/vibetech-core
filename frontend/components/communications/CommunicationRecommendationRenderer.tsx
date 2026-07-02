"use client";

import { useContext } from "react";
import { CommunicationViewModelContext } from "./CommunicationContext";

export default function CommunicationRecommendationRenderer() {
  const vm = useContext(CommunicationViewModelContext);
  const actions = (vm?.recommendedActions ?? []) as any[];

  if (!actions.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Recommended actions</div>
        <div className="mt-2 text-sm text-muted-foreground">Communication activity is running normally.</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Recommended actions</div>
      <div className="mt-3 space-y-2">
        {actions.slice(0, 6).map((a) => (
          <div key={a.id} className="rounded-lg border border-border/60 bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{a.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{a.type}</div>
              </div>
              <div className="text-[11px] rounded-full border px-2 py-1 bg-background">{a.priority}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

