"use client";

import { useContext } from "react";
import type { RequestViewModel } from "./RequestContext";
import { RequestViewModelContext } from "./RequestContext";

function numberOr0(v: any) {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function RequestSummary() {
  const viewModel = useContext<RequestViewModel | null>(RequestViewModelContext);
  if (!viewModel) return null;

  const metrics = viewModel.metrics ?? {};
  const attention = viewModel.attention ?? {};
  const recs = Array.isArray(viewModel.recommendedActions) ? viewModel.recommendedActions : [];
  const queues = Array.isArray(viewModel.queues) ? viewModel.queues : [];

  const attentionItems = Array.isArray(attention.items) ? attention.items : [];

  const attentionLine =
    attentionItems.length > 0
      ? `${attentionItems.length} attention item(s)`
      : "No requests require immediate attention.";

  const queueLine = queues.length > 0 ? `${queues.length} queue(s) configured.` : "No incoming requests.";
  const recLine = recs.length > 0 ? `${recs.length} recommendation(s) queued.` : "No recommendations at this time.";

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Requests</div>
          <div className="mt-2 text-base font-semibold leading-tight">{String(viewModel.summary ?? "").trim() || "Request overview"}</div>
          <div className="mt-1 text-sm text-muted-foreground">{recLine}</div>
          <div className="mt-2 text-xs text-muted-foreground">{attentionLine}</div>
          <div className="mt-1 text-xs text-muted-foreground">{queueLine}</div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Total requests</div>
            <div className="mt-2 text-2xl font-semibold">{numberOr0(metrics.totalRequests)}</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Qualified</div>
            <div className="mt-2 text-2xl font-semibold">{numberOr0(metrics.qualifiedRequests)}</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Closed</div>
            <div className="mt-2 text-2xl font-semibold">{numberOr0(metrics.closedRequests)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

