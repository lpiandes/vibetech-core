"use client";

import { useContext } from "react";
import { CommunicationViewModelContext } from "./CommunicationContext";

export default function CommunicationThreadRenderer() {
  const vm = useContext(CommunicationViewModelContext);
  const threads = (vm?.threads ?? []) as any[];

  if (!threads.length) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Conversations</div>
        <div className="mt-2 text-sm text-muted-foreground">No conversations require immediate attention.</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Conversations</div>
      <div className="mt-3 space-y-2">
        {threads.map((t) => (
          <div key={t.id} className="rounded-lg border border-border/60 bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{t.subject}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t.channel} · {t.messageCount} message(s)
                </div>
              </div>
              <div className="text-xs rounded-full border px-2 py-1 bg-background">{t.status}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(t.badges ?? []).slice(0, 4).map((b: any) => (
                <span key={`${t.id}_${b}`} className="text-[11px] rounded-full border border-border/60 px-2 py-1">
                  {b}
                </span>
              ))}
              {t.attentionRequired ? (
                <span className="text-[11px] rounded-full bg-destructive/10 border border-destructive/30 px-2 py-1">Needs Attention</span>
              ) : null}
            </div>
            {Array.isArray(t.actions) && t.actions.length ? (
              <div className="mt-2 text-xs text-muted-foreground">Actions: {t.actions.length}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

