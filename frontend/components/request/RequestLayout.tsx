"use client";

import { useContext } from "react";
import type { RequestViewModel } from "./RequestContext";
import { RequestViewModelContext } from "./RequestContext";

import RequestSummary from "./RequestSummary";
import RequestQueueRenderer from "./RequestQueueRenderer";
import RequestAttentionRenderer from "./RequestAttentionRenderer";
import RequestRecommendationRenderer from "./RequestRecommendationRenderer";

function layoutClass(layout: string) {
  switch (layout) {
    case "twoColumn":
      return "grid grid-cols-1 md:grid-cols-2 gap-4";
    case "single":
    default:
      return "grid grid-cols-1 gap-4";
  }
}

export default function RequestLayout() {
  const viewModel = useContext<RequestViewModel | null>(RequestViewModelContext);
  if (!viewModel) return null;

  const layout = String(viewModel?.metadata?.layout ?? "single");
  const grid = layoutClass(layout);

  return (
    <div className="mx-auto w-full max-w-6xl px-10 py-12">
      <div className="space-y-6">
        <RequestSummary />
        <div className={grid}>
          <div className="space-y-4">
            <RequestQueueRenderer />
          </div>
          <div className="space-y-4">
            <RequestAttentionRenderer />
            <RequestRecommendationRenderer />
          </div>
        </div>
      </div>
    </div>
  );
}

