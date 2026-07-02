"use client";

import { useContext } from "react";
import { KnowledgeViewModelContext } from "./KnowledgeContext";

export default function KnowledgeSummary() {
  const viewModel = useContext<any | null>(KnowledgeViewModelContext);
  if (!viewModel) return null;

  const categories = Array.isArray(viewModel.categories) ? viewModel.categories : [];
  const items = Array.isArray(viewModel.items) ? viewModel.items : [];
  const recs = Array.isArray(viewModel.recommendations) ? viewModel.recommendations : [];

  const summaryText =
    String(viewModel.summary ?? "").trim() ||
    (items.length > 0
      ? "Knowledge is ready for consistent execution."
      : "No knowledge has been published yet.");

  const repositorySummary =
    String(viewModel.repositorySummary ?? "").trim() ||
    `${items.length} knowledge item(s) available`;

  const categorySummary =
    String(viewModel.categorySummary ?? "").trim() || `${categories.length} categor${categories.length === 1 ? "y" : "ies"} configured`;

  const coverageSummary =
    String(viewModel.coverageSummary ?? "").trim() ||
    (categories.length > 0 ? "Coverage is visible across configured categories." : "Coverage will appear after knowledge is published.");

  const recommendationSummary =
    String(viewModel.recommendationSummary ?? "").trim() ||
    (recs.length > 0 ? `${recs.length} recommendation(s) available.` : "No recommendations at this time.");

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Knowledge</div>
          <div className="mt-2 text-base font-semibold leading-tight">{summaryText}</div>
          <div className="mt-1 text-sm text-muted-foreground">{repositorySummary}</div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Categories</div>
            <div className="mt-2 text-2xl font-semibold">{String(categories.length)}</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Coverage</div>
            <div className="mt-2 text-2xl font-semibold">{categories.length > 0 ? "Ready" : "Pending"}</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Recommendations</div>
            <div className="mt-2 text-2xl font-semibold">{String(recs.length)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
          {categorySummary}
        </div>
        <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
          {coverageSummary} {recommendationSummary}
        </div>
      </div>
    </section>
  );
}

