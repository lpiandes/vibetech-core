"use client";

import { useContext } from "react";
import { CommunicationViewModelContext } from "./CommunicationContext";

export default function CommunicationMessageRenderer() {
  const vm = useContext(CommunicationViewModelContext);
  const messages = (vm?.messages ?? []) as any[];

  if (!messages.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Messages</div>
        <div className="mt-2 text-sm text-muted-foreground">No messages are currently in view.</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Messages</div>
      <div className="mt-3 space-y-2">
        {messages.slice(0, 8).map((m) => (
          <div key={m.id} className="rounded-lg border border-border/60 bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{m.subject}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {m.channel} · {m.direction} · {m.status}
                </div>
              </div>
              {m.attentionRequired ? (
                <div className="text-[11px] rounded-full bg-destructive/10 border border-destructive/30 px-2 py-1">
                  Needs Attention
                </div>
              ) : null}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{m.bodyPreview}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

