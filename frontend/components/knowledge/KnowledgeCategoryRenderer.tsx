"use client";

import { useContext } from "react";
import { KnowledgeViewModelContext } from "./KnowledgeContext";

export default function KnowledgeCategoryRenderer() {
  const viewModel = useContext<any | null>(KnowledgeViewModelContext);
  if (!viewModel) return null;

  const categories = Array.isArray(viewModel.categories) ? viewModel.categories : [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Categories</div>
          <div className="mt-1 text-xs text-muted-foreground">Approved knowledge groupings</div>
        </div>
        <div className="text-xs text-muted-foreground">{String(categories.length)} category(s)</div>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No knowledge categories have been configured yet.
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((c: any) => {
            const itemCount = Array.isArray(c.items) ? c.items.length : Array.isArray(c.knowledgeItems) ? c.knowledgeItems.length : 0;
            return (
              <div key={String(c.id)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{String(c.name ?? c.id)}</div>
                    {c.description ? <div className="mt-1 text-xs text-muted-foreground">{String(c.description)}</div> : null}
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">{String(itemCount)} item(s)</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

