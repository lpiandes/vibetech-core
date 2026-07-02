"use client";

import { useContext } from "react";

import type { WorkViewModel } from "./WorkContext";
import { WorkViewModelContext } from "./WorkContext";
import WorkSummary from "./WorkSummary";
import QueueRenderer from "./QueueRenderer";
import StageRenderer from "./StageRenderer";
import WorkItemRenderer from "./WorkItemRenderer";
import AssignmentRenderer from "./AssignmentRenderer";
import AttentionRenderer from "./AttentionRenderer";
import RecommendationRenderer from "./RecommendationRenderer";

function layoutClass(layout: string) {
  switch (layout) {
    case "twoColumn":
      return "grid grid-cols-1 md:grid-cols-2 gap-4";
    case "single":
    default:
      return "grid grid-cols-1 gap-4";
  }
}

export default function WorkLayout() {
  const viewModel = useContext<WorkViewModel | null>(WorkViewModelContext);
  if (!viewModel) return null;

  const layout = String(viewModel?.metadata?.layout ?? "single");
  const grid = layoutClass(layout);

  return (
    <div className="mx-auto w-full max-w-6xl px-10 py-12">
      <div className="space-y-6">
        <WorkSummary />

        <div className={grid}>
          <div className="space-y-4">
            <QueueRenderer />
            <StageRenderer />
          </div>

          <div className="space-y-4">
            <WorkItemRenderer />
            <AssignmentRenderer />
            <AttentionRenderer />
            <RecommendationRenderer />
          </div>
        </div>
      </div>
    </div>
  );
}

