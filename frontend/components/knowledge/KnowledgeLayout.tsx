"use client";

import { useContext } from "react";

import type { KnowledgeViewModel } from "./KnowledgeContext";
import { KnowledgeViewModelContext } from "./KnowledgeContext";

import KnowledgeSummary from "./KnowledgeSummary";
import KnowledgeCategoryRenderer from "./KnowledgeCategoryRenderer";
import KnowledgeItemRenderer from "./KnowledgeItemRenderer";
import KnowledgeSearchRenderer from "./KnowledgeSearchRenderer";
import KnowledgeRecommendationRenderer from "./KnowledgeRecommendationRenderer";

function layoutClass(layout: string) {
  switch (layout) {
    case "twoColumn":
      return "grid grid-cols-1 md:grid-cols-2 gap-4";
    case "single":
    default:
      return "grid grid-cols-1 gap-4";
  }
}

export default function KnowledgeLayout() {
  const viewModel = useContext<KnowledgeViewModel | null>(KnowledgeViewModelContext);
  if (!viewModel) return null;

  const layout = String(viewModel?.metadata?.layout ?? "single");

  return (
    <div className="mx-auto w-full max-w-6xl px-10 py-12">
      <div className="space-y-6">
        <KnowledgeSummary />
        <div className={layoutClass(layout)}>
          <div className="space-y-4">
            <KnowledgeSearchRenderer />
            <KnowledgeCategoryRenderer />
          </div>
          <div className="space-y-4">
            <KnowledgeItemRenderer />
            <KnowledgeRecommendationRenderer />
          </div>
        </div>
      </div>
    </div>
  );
}

