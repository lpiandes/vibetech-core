"use client";

import { useContext } from "react";
import { CommunicationViewModelContext } from "./CommunicationContext";

export default function CommunicationQueueRenderer() {
  const vm = useContext(CommunicationViewModelContext);
  const queues = (vm?.queues ?? []) as any[];

  if (!queues.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Queues</div>
        <div className="mt-2 text-sm text-muted-foreground">No communication queues have been configured yet.</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Queues</div>
      <div className="mt-3 space-y-2">
        {queues.map((q) => (
          <div key={q.id} className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">{q.name}</div>
              <div className="text-xs text-muted-foreground">{q.summary}</div>
            </div>
            <div className="text-xs rounded-full border px-2 py-1 bg-background">{q.status}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

