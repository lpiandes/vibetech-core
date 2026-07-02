"use client";

import { useContext } from "react";
import { CommunicationViewModelContext } from "./CommunicationContext";

export default function CommunicationAttentionRenderer() {
  const vm = useContext(CommunicationViewModelContext);
  const attention = vm?.attention ?? { summary: "", items: [] };
  const items = (attention.items ?? []) as any[];

  if (!items.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Needs attention</div>
        <div className="mt-2 text-sm text-muted-foreground">No communications require immediate attention.</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Needs attention</div>
      <div className="mt-1 text-xs text-muted-foreground">{attention.summary}</div>
      <div className="mt-3 space-y-2">
        {items.map((i) => (
          <div key={i.id} className="rounded-lg border border-border/60 bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium">{i.summary}</div>
              <div className="text-[11px] rounded-full border px-2 py-1 bg-background">{i.priority}</div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Category: {i.category}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

