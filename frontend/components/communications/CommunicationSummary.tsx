"use client";

import { useContext } from "react";
import { CommunicationViewModelContext } from "./CommunicationContext";

export default function CommunicationSummary() {
  const vm = useContext(CommunicationViewModelContext);

  const summary = vm?.summary ?? "";
  const attentionCount = Number(vm?.metrics?.attentionThreadCount ?? 0);
  const healthLabel = attentionCount > 0 ? "Needs attention" : "Running normally";
  const healthCopy =
    attentionCount > 0
      ? `${attentionCount} conversation(s) require immediate attention.`
      : "Communication activity is running normally.";

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-sm font-semibold">Communication dashboard</div>
      <div className="mt-1 text-sm text-muted-foreground">{summary}</div>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Communication health</div>
          <div className="mt-1 text-lg font-bold">{healthLabel}</div>
        </div>
        <div className="text-sm text-muted-foreground">{healthCopy}</div>
      </div>
    </section>
  );
}

