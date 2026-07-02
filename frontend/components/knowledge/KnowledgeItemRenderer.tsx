"use client";

import { useContext } from "react";
import { KnowledgeViewModelContext } from "./KnowledgeContext";

export default function KnowledgeItemRenderer() {
  const viewModel = useContext<any | null>(KnowledgeViewModelContext);
  if (!viewModel) return null;

  const items = Array.isArray(viewModel.items) ? viewModel.items : [];

  if (items.length === 0) {
    return (
      <section>
        <div className="mb-4 text-sm font-semibold">Knowledge Items</div>
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No knowledge has been published yet.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Knowledge Items</div>
          <div className="mt-1 text-xs text-muted-foreground">Published content ready for consistent execution</div>
        </div>
        <div className="text-xs text-muted-foreground">{String(items.length)} item(s)</div>
      </div>

      <div className="space-y-3">
        {items.map((it: any) => (
          <div key={String(it.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{String(it.title ?? "")}</div>
                {it.description ? <div className="mt-1 text-xs text-muted-foreground">{String(it.description)}</div> : null}
                {it.category ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Category: {String(it.category)}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">{String(it.status ?? "")}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

